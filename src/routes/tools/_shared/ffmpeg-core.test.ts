import type { FFmpeg } from '@ffmpeg/ffmpeg';
import { afterEach, expect, it, vi } from 'vitest';
import { loadFfmpegCore } from './ffmpeg-core';

function mockObjectUrls() {
	const createObjectURL = vi.fn((blob: Blob) => `blob:${blob.type}`);
	const revokeObjectURL = vi.fn();
	vi.stubGlobal(
		'URL',
		class extends URL {
			static createObjectURL = createObjectURL;
			static revokeObjectURL = revokeObjectURL;
		}
	);
	return revokeObjectURL;
}

afterEach(() => vi.unstubAllGlobals());

it('aborts a pending WASM download and releases the already downloaded core script', async () => {
	const revoke = mockObjectUrls();
	const controller = new AbortController();
	const load = vi.fn();
	const fetchAsset = vi
		.fn()
		.mockResolvedValueOnce(new Response('script'))
		.mockImplementationOnce(
			(_url, { signal }: { signal: AbortSignal }) =>
				new Promise((_, reject) => {
					signal.addEventListener('abort', () => reject(signal.reason), { once: true });
				})
		);
	vi.stubGlobal('fetch', fetchAsset);
	const loading = loadFfmpegCore({ load } as unknown as FFmpeg, controller.signal);
	await vi.waitFor(() => expect(fetchAsset).toHaveBeenCalledTimes(2));
	controller.abort();
	await expect(loading).rejects.toMatchObject({ name: 'AbortError' });
	expect(load).not.toHaveBeenCalled();
	expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:text/javascript');
});

it('releases both temporary URLs once the Worker has loaded the core', async () => {
	const revoke = mockObjectUrls();
	const signal = new AbortController().signal;
	const load = vi.fn().mockResolvedValue(true);
	vi.stubGlobal(
		'fetch',
		vi.fn().mockImplementation(() => new Response('data'))
	);
	await loadFfmpegCore({ load } as unknown as FFmpeg, signal);
	expect(load).toHaveBeenCalledExactlyOnceWith(
		{ coreURL: 'blob:text/javascript', wasmURL: 'blob:application/wasm' },
		{ signal }
	);
	expect(revoke.mock.calls).toEqual([['blob:text/javascript'], ['blob:application/wasm']]);
});
