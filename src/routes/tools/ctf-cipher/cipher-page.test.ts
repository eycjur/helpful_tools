import { act, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Page from './+page.svelte';
import { decryptText } from './cipher-tools';
import type { DecryptResponse } from './types';

const workers: TestWorker[] = [];

class TestWorker {
	onmessage?: (event: MessageEvent<DecryptResponse>) => void;
	postMessage = vi.fn<(input: string) => void>();
	terminate = vi.fn();

	constructor() {
		workers.push(this);
	}

	async finish(input: string) {
		await act(() => {
			this.onmessage?.(new MessageEvent('message', { data: { groups: decryptText(input) } }));
		});
	}
}

describe('暗号解読の入力変更', () => {
	beforeEach(() => {
		workers.length = 0;
		vi.stubGlobal('Worker', TestWorker);
	});

	afterEach(() => vi.unstubAllGlobals());

	it('解読済みの入力を編集すると、以前の結果とコピー操作を消す', async () => {
		render(Page);
		const input = screen.getByRole('textbox');
		const original = 'SGVsbG8gV29ybGQ=';
		const updated = 'TmV3IG1lc3NhZ2U=';

		await fireEvent.input(input, { target: { value: original } });
		await fireEvent.click(screen.getByRole('button', { name: '自動解読' }));
		await workers[0].finish(original);
		expect(screen.getByText('Hello World')).toBeDefined();
		expect(screen.getAllByRole('button', { name: 'コピー' }).length).toBeGreaterThan(0);

		await fireEvent.input(input, { target: { value: updated } });
		expect(screen.queryByText('Hello World')).toBeNull();
		expect(screen.queryAllByRole('button', { name: 'コピー' })).toHaveLength(0);

		await fireEvent.click(screen.getByRole('button', { name: '自動解読' }));
		expect(workers[1].postMessage).toHaveBeenCalledWith(updated);
		await workers[1].finish(updated);
		expect(screen.getByText('New message')).toBeDefined();
	});
});
