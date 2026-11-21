import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, expect, it, vi } from 'vitest';
import { loadFfmpegCore } from '../_shared/ffmpeg-core';
import Page from './+page.svelte';

const { exec, terminate } = vi.hoisted(() => ({
	exec: vi.fn().mockResolvedValue(0),
	terminate: vi.fn()
}));
vi.mock('../_shared/ffmpeg-core', () => ({ loadFfmpegCore: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@ffmpeg/ffmpeg', () => ({
	FFmpeg: class {
		loaded = true;
		on = vi.fn();
		load = vi.fn();
		writeFile = vi.fn();
		deleteFile = vi.fn();
		readFile = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
		exec = exec;
		terminate = terminate;
	}
}));

afterEach(() => {
	vi.clearAllMocks();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

it('preserves the encoded format and recovers after a failed re-encode', async () => {
	vi.stubGlobal(
		'URL',
		class extends URL {
			static createObjectURL = vi.fn(() => 'blob:output');
			static revokeObjectURL = vi.fn();
		}
	);
	const { container } = render(Page);
	const input = container.querySelector('input[type="file"]')!;
	const video = new File(['test'], 'video.webm', { type: 'video/webm' });
	video.arrayBuffer = async () => new Uint8Array([1]).buffer;
	await fireEvent.change(input, { target: { files: [video] } });
	const extract = screen.getByRole<HTMLButtonElement>('button', { name: '音声を抽出' });
	await waitFor(() => expect(extract.disabled).toBe(false));
	await fireEvent.click(extract);
	const download = await screen.findByRole('button', { name: 'ダウンロード' });
	await fireEvent.change(screen.getByLabelText('出力形式'), { target: { value: 'aac' } });
	let downloadedName = '';
	vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
		this: HTMLAnchorElement
	) {
		downloadedName = this.download;
	});
	await fireEvent.click(download);
	expect(downloadedName).toBe('video.mp3');

	vi.spyOn(console, 'error').mockImplementation(() => {});
	exec.mockResolvedValueOnce(1);
	await fireEvent.click(extract);
	await screen.findByText(/音声トラックがないか/);
	expect(screen.queryByRole('button', { name: 'ダウンロード' })).toBeNull();
	await waitFor(() => expect(extract.disabled).toBe(false));
	expect(terminate).toHaveBeenCalledTimes(1);
	expect(loadFfmpegCore).toHaveBeenCalledTimes(2);
	await fireEvent.click(extract);
	await screen.findByText(/AAC \(M4A\) 形式で変換完了/);
});

it('blocks MP3 bitrates above the MPEG-2 limit at 22.05 kHz', async () => {
	vi.stubGlobal(
		'URL',
		class extends URL {
			static createObjectURL = vi.fn(() => 'blob:video');
			static revokeObjectURL = vi.fn();
		}
	);
	const { container } = render(Page);
	const file = new File(['video'], 'video.webm', { type: 'video/webm' });
	file.arrayBuffer = async () => new Uint8Array([1]).buffer;
	await fireEvent.change(container.querySelector('input[type="file"]')!, {
		target: { files: [file] }
	});
	const extract = screen.getByRole<HTMLButtonElement>('button', { name: '音声を抽出' });
	await waitFor(() => expect(extract.disabled).toBe(false));
	await fireEvent.change(screen.getByLabelText('サンプルレート'), { target: { value: '22050' } });
	expect(extract.disabled).toBe(true);
	expect(screen.getByRole<HTMLOptionElement>('option', { name: /^192 kbps/ }).disabled).toBe(true);
	expect(screen.getByText('22.05 kHzのMP3では128 kbpsを選択してください。')).toBeTruthy();
	await fireEvent.change(screen.getByLabelText('ビットレート'), { target: { value: '128' } });
	expect(extract.disabled).toBe(false);
	await fireEvent.click(extract);
	await screen.findByRole('button', { name: 'ダウンロード' });
	expect(exec).toHaveBeenCalledWith([
		'-i',
		'input.webm',
		'-vn',
		'-acodec',
		'libmp3lame',
		'-b:a',
		'128k',
		'-ar',
		'22050',
		'output.mp3'
	]);
});
