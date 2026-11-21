import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Page from './+page.svelte';
import { findMatches } from './matches';
import type { MatchRequest, MatchWorkerMessage } from './matches.worker';

const workers: TestWorker[] = [];

class TestWorker {
	onmessage: ((event: MessageEvent<MatchWorkerMessage>) => void) | null = null;
	onerror: (() => void) | null = null;
	postMessage = vi.fn<(request: MatchRequest) => void>();
	terminate = vi.fn();

	constructor() {
		workers.push(this);
	}

	respond(response: MatchWorkerMessage) {
		this.onmessage?.(new MessageEvent('message', { data: response }));
	}
}

describe('正規表現テスターのWorker', () => {
	beforeEach(() => {
		workers.length = 0;
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		vi.stubGlobal('Worker', TestWorker);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('Workerの起動時間を除き、評価開始から1秒で停止する', async () => {
		const { container } = render(Page);
		const pattern = screen.getByLabelText('【入力】正規表現');
		await fireEvent.input(screen.getByLabelText('【入力】テスト文字列'), {
			target: { value: 'ab' }
		});
		await fireEvent.input(pattern, { target: { value: 'a' } });

		const first = workers[0];
		expect(screen.getByRole('status').textContent).toBe('評価中…');
		expect(first.postMessage).toHaveBeenCalledWith({ pattern: 'a', flags: 'gu', input: 'ab' });

		await vi.advanceTimersByTimeAsync(2000);
		expect(first.terminate).not.toHaveBeenCalled();
		expect(screen.getByRole('status').textContent).toBe('評価中…');

		first.respond({ started: true });
		await vi.advanceTimersByTimeAsync(999);
		expect(first.terminate).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		await tick();
		expect(first.terminate).toHaveBeenCalledOnce();
		expect(screen.getByText(/評価が1秒以内に完了しませんでした/)).toBeDefined();

		await fireEvent.input(pattern, { target: { value: 'b' } });
		const second = workers[1];
		first.respond({ matches: findMatches(/a/gu, 'ab') });
		second.respond({ started: true });
		second.respond({ matches: findMatches(/b/gu, 'ab') });
		await tick();

		expect(second.terminate).toHaveBeenCalledOnce();
		expect(container.querySelector('mark')?.textContent).toBe('b');
		expect(screen.queryByText(/評価が1秒以内に完了しませんでした/)).toBeNull();
	});

	it('Workerの読み込みに失敗したらエラーを表示する', async () => {
		render(Page);
		await fireEvent.input(screen.getByLabelText('【入力】正規表現'), {
			target: { value: 'b' }
		});
		workers[0].onerror?.();
		await tick();

		expect(workers[0].terminate).toHaveBeenCalledOnce();
		expect(screen.getByText('正規表現を実行できませんでした')).toBeDefined();
	});

	it('入力が変わった時とページを離れた時に評価を取り消す', async () => {
		const { container, unmount } = render(Page);
		await fireEvent.input(screen.getByLabelText('【入力】正規表現'), {
			target: { value: 'b' }
		});
		await fireEvent.input(screen.getByLabelText('【入力】テスト文字列'), {
			target: { value: 'abc' }
		});

		expect(workers[0].terminate).toHaveBeenCalledOnce();
		workers[0].respond({ started: true });
		workers[0].respond({ error: '古い評価のエラー' });
		await vi.advanceTimersByTimeAsync(1000);
		expect(container.textContent).not.toContain('古い評価のエラー');
		expect(workers[1].terminate).not.toHaveBeenCalled();
		expect(workers[1].postMessage).toHaveBeenCalledWith({
			pattern: 'b',
			flags: 'gu',
			input: 'abc'
		});

		await unmount();
		expect(workers[1].terminate).toHaveBeenCalledOnce();
	});

	it('一覧とハイライトを一緒にページ送りし、入力変更で先頭に戻る', async () => {
		const { container } = render(Page);
		const inputField = screen.getByLabelText('【入力】テスト文字列');
		const input = '<前>' + 'a '.repeat(50) + 'b b b<後>';
		await fireEvent.input(inputField, { target: { value: input } });
		await fireEvent.input(screen.getByLabelText('【入力】正規表現'), {
			target: { value: '[ab]' }
		});
		workers[0].respond({ matches: findMatches(/[ab]/gu, input) });
		await tick();

		const previous = screen.getByRole<HTMLButtonElement>('button', { name: '前のページ' });
		const next = screen.getByRole<HTMLButtonElement>('button', { name: '次のページ' });
		const preview = container.querySelector('.whitespace-pre-wrap')!;
		expect(screen.getByText('一致: 53 件')).toBeDefined();
		expect(previous.disabled).toBe(true);
		expect(preview.querySelectorAll('mark')).toHaveLength(50);
		expect(preview.textContent).toBe(input.slice(0, 103));
		expect(screen.getByText('#50 @ 101 (1文字)')).toBeDefined();
		expect(screen.queryByText('#51 @ 103 (1文字)')).toBeNull();

		await fireEvent.click(next);
		expect(next.disabled).toBe(true);
		expect(preview.querySelectorAll('mark')).toHaveLength(3);
		expect(preview.textContent).toBe('b b b<後>');
		expect(screen.queryByText('#50 @ 101 (1文字)')).toBeNull();
		expect(screen.getByText('#51 @ 103 (1文字)')).toBeDefined();
		expect(screen.getByText('#53 @ 107 (1文字)')).toBeDefined();

		await fireEvent.click(previous);
		expect(preview.querySelectorAll('mark')).toHaveLength(50);
		await fireEvent.click(next);
		const updatedInput = 'c' + input;
		await fireEvent.input(inputField, { target: { value: updatedInput } });
		workers[1].respond({ matches: findMatches(/[ab]/gu, updatedInput) });
		await tick();
		expect(screen.getByText('1 / 2 ページ（1〜50件目）')).toBeDefined();
		expect(screen.getByText('#1 @ 4 (1文字)')).toBeDefined();
		expect(preview.querySelectorAll('mark')).toHaveLength(50);
	});
});
