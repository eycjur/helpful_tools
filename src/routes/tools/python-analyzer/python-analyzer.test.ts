import { act, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PythonAnalyzer from './+page.svelte';
import type { PythonResponse } from './python-worker-messages';

const workers: WorkerStub[] = [];

class WorkerStub {
	onmessage?: (event: MessageEvent<PythonResponse>) => void;
	onerror?: (event: ErrorEvent) => void;
	postMessage = vi.fn();
	terminate = vi.fn();

	constructor() {
		workers.push(this);
	}

	async respond(data: PythonResponse) {
		await act(() => this.onmessage?.(new MessageEvent('message', { data })));
	}

	async fail(message: string) {
		await act(() => this.onerror?.(new ErrorEvent('error', { message })));
	}
}

beforeEach(() => {
	workers.length = 0;
	vi.stubGlobal('Worker', WorkerStub);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('Python解析', () => {
	it('タイムアウトしたWorkerを破棄し、新しいWorkerで再実行する', async () => {
		vi.useFakeTimers();
		const { unmount } = render(PythonAnalyzer);
		const execute = screen.getByRole<HTMLButtonElement>('button', { name: 'コードを実行' });
		const input = screen.getByRole('textbox');
		const [original] = workers;
		expect(execute.disabled).toBe(true);
		await original.respond({ type: 'ready' });
		await fireEvent.input(input, { target: { value: 'while True: pass' } });
		await fireEvent.click(execute);
		expect(original.postMessage).toHaveBeenCalledWith({
			operation: 'run',
			code: 'while True: pass'
		});
		expect(execute.disabled).toBe(true);

		await act(() => vi.advanceTimersByTimeAsync(5000));
		expect(original.terminate).toHaveBeenCalledOnce();
		expect(screen.getByRole('alert').textContent).toContain('タイムアウトしました（5秒）');
		const [, replacement] = workers;
		expect(execute.disabled).toBe(true);
		await replacement.respond({ type: 'ready' });

		await fireEvent.input(input, { target: { value: 'print("ok")' } });
		await fireEvent.click(execute);
		await original.respond({ type: 'execution', output: '古い結果' });
		expect(screen.queryByText('古い結果')).toBeNull();
		expect(execute.disabled).toBe(true);
		expect(replacement.postMessage).toHaveBeenCalledWith({ operation: 'run', code: 'print("ok")' });
		await replacement.respond({ type: 'execution', output: 'ok' });
		expect(screen.getByText('ok')).toBeTruthy();
		expect(screen.queryByRole('alert')).toBeNull();

		await act(() => vi.advanceTimersByTimeAsync(5000));
		expect(replacement.terminate).not.toHaveBeenCalled();
		unmount();
		expect(replacement.terminate).toHaveBeenCalledOnce();
	});

	it('Pythonのエラーを表示し、同じWorkerを再利用する', async () => {
		render(PythonAnalyzer);
		const [worker] = workers;
		await worker.respond({ type: 'ready' });
		const analyze = screen.getByRole<HTMLButtonElement>('button', {
			name: 'AST & Bytecode を生成'
		});
		await fireEvent.click(analyze);
		await worker.respond({ type: 'error', message: 'SyntaxError' });
		expect(screen.getByRole('alert').textContent).toContain(
			'コード解析に失敗しました: SyntaxError'
		);
		expect(analyze.disabled).toBe(false);
		await fireEvent.click(analyze);
		await worker.respond({ type: 'analysis', ast: 'Module()', bytecode: 'RETURN_VALUE' });
		expect(screen.getByText('Module()')).toBeTruthy();
		expect(screen.getByText('RETURN_VALUE')).toBeTruthy();
		expect(worker.terminate).not.toHaveBeenCalled();
	});

	it('実行中にWorkerが異常終了した場合、新しいWorkerで再実行できる', async () => {
		render(PythonAnalyzer);
		const execute = screen.getByRole<HTMLButtonElement>('button', { name: 'コードを実行' });
		const [original] = workers;
		await original.respond({ type: 'ready' });
		await fireEvent.click(execute);
		await original.fail('worker failure');
		expect(original.terminate).toHaveBeenCalledOnce();
		expect(screen.getByRole('alert').textContent).toContain(
			'コード実行に失敗しました: worker failure'
		);
		expect(workers).toHaveLength(2);
		expect(execute.disabled).toBe(true);

		const [, replacement] = workers;
		await replacement.respond({ type: 'ready' });
		await fireEvent.click(execute);
		await replacement.respond({ type: 'execution', output: 'recovered' });
		expect(screen.getByText('recovered')).toBeTruthy();
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('Workerの初期化中のエラーでは再試行しない', async () => {
		render(PythonAnalyzer);
		const [worker] = workers;
		await worker.fail('initialization failure');
		expect(worker.terminate).toHaveBeenCalledOnce();
		expect(workers).toHaveLength(1);
		expect(screen.getByRole('alert').textContent).toContain('Python環境の読み込みに失敗しました');
		expect(screen.getByRole<HTMLButtonElement>('button', { name: 'コードを実行' }).disabled).toBe(
			true
		);
	});
});
