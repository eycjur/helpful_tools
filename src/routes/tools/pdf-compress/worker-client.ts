/**
 * 圧縮Workerの呼び出し。ジョブごとにWorkerを作り、完了・失敗・キャンセルで破棄する
 */
import type { SpaceReport } from './pdf-optimizer';
import type { CompressProgress, CompressResult } from './compress';
import type { CompressSettings } from './levels';
import type { WorkerRequest, WorkerResponse } from './compress.worker';

export class CancelledError extends Error {
	constructor() {
		super('キャンセルしました');
	}
}

export type Job<T> = { promise: Promise<T>; cancel: () => void };

function run<T>(
	request: WorkerRequest,
	pick: (res: WorkerResponse) => T | undefined,
	onProgress?: (p: CompressProgress) => void
): Job<T> {
	const worker = new Worker(new URL('./compress.worker.ts', import.meta.url), { type: 'module' });
	let reject: (e: Error) => void = () => {};
	const promise = new Promise<T>((resolve, rej) => {
		reject = rej;
		worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
			const res = e.data;
			if (res.type === 'progress') return onProgress?.(res.progress);
			worker.terminate();
			if (res.type === 'error') return rej(new Error(res.message));
			const value = pick(res);
			if (value === undefined) rej(new Error('想定外の応答です'));
			else resolve(value);
		};
		worker.onmessageerror = () => {
			worker.terminate();
			rej(new Error('Workerからの応答を受け取れませんでした'));
		};
		worker.onerror = (e) => {
			worker.terminate();
			rej(new Error(e.message || 'Workerでエラーが発生しました'));
		};
	});
	// 呼び出し側は元のバイト列を使い続けるため、コピーを転送する
	const bytes = request.bytes.slice();
	worker.postMessage({ ...request, bytes }, [bytes.buffer]);
	return {
		promise,
		cancel: () => {
			worker.terminate();
			reject(new CancelledError());
		}
	};
}

export function analyzeInWorker(bytes: Uint8Array): Job<SpaceReport> {
	return run({ type: 'analyze', bytes }, (res) =>
		res.type === 'analyzed' ? res.report : undefined
	);
}

export function compressInWorker(
	bytes: Uint8Array,
	settings: CompressSettings,
	onProgress: (p: CompressProgress) => void
): Job<{ result: CompressResult; report: SpaceReport | null }> {
	return run(
		{ type: 'compress', bytes, settings },
		(res) => (res.type === 'compressed' ? { result: res.result, report: res.report } : undefined),
		onProgress
	);
}
