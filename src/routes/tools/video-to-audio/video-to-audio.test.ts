import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, expect, it, vi } from 'vitest';
import Page from './+page.svelte';

const { exec } = vi.hoisted(() => ({ exec: vi.fn().mockResolvedValue(0) }));
vi.mock('@ffmpeg/util', () => ({ toBlobURL: vi.fn().mockResolvedValue('blob:core') }));
vi.mock('@ffmpeg/ffmpeg', () => ({
	FFmpeg: class {
		loaded = true;
		on = vi.fn();
		load = vi.fn();
		writeFile = vi.fn();
		deleteFile = vi.fn();
		readFile = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
		exec = exec;
		terminate = vi.fn();
	}
}));

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

it('downloads using the encoded format and hides a failed re-encode', async () => {
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
});
