import type { FFmpeg } from '@ffmpeg/ffmpeg';

const CORE_BASE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

async function fetchCoreAsset(
	name: string,
	mimeType: string,
	signal: AbortSignal
): Promise<string> {
	const response = await fetch(`${CORE_BASE_URL}/${name}`, { signal });
	if (!response.ok) throw new Error(`${name} の取得に失敗しました (${response.status})`);
	const data = await response.arrayBuffer();
	signal.throwIfAborted();
	return URL.createObjectURL(new Blob([data], { type: mimeType }));
}

export async function loadFfmpegCore(ffmpeg: FFmpeg, signal: AbortSignal): Promise<void> {
	const coreURL = await fetchCoreAsset('ffmpeg-core.js', 'text/javascript', signal);
	let wasmURL: string | undefined;
	try {
		wasmURL = await fetchCoreAsset('ffmpeg-core.wasm', 'application/wasm', signal);
		signal.throwIfAborted();
		await ffmpeg.load({ coreURL, wasmURL }, { signal });
	} finally {
		URL.revokeObjectURL(coreURL);
		if (wasmURL) URL.revokeObjectURL(wasmURL);
	}
}
