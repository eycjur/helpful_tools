import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, expect, it, vi } from 'vitest';
import Page from './+page.svelte';

const { exec } = vi.hoisted(() => ({ exec: vi.fn() }));
vi.mock('@ffmpeg/util', () => ({ toBlobURL: vi.fn().mockResolvedValue('blob:core') }));
vi.mock('@ffmpeg/ffmpeg', () => ({
	FFmpeg: class {
		loaded = true;
		on = vi.fn();
		load = vi.fn();
		writeFile = vi.fn();
		deleteFile = vi.fn().mockResolvedValue(true);
		readFile = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
		exec = exec;
		terminate = vi.fn();
	}
}));

afterEach(() => vi.unstubAllGlobals());

it('retries without audio and labels the actual output after FFmpeg reports a failed audio pass', async () => {
	exec.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
	vi.stubGlobal(
		'URL',
		class extends URL {
			static createObjectURL = vi.fn(() => 'blob:output');
			static revokeObjectURL = vi.fn();
		}
	);
	const { container } = render(Page);
	const input = container.querySelector('input[type="file"]')!;
	const file = new File(['test'], 'silent.webm', { type: 'video/webm' });
	file.arrayBuffer = async () => new Uint8Array([1]).buffer;
	await fireEvent.change(input, { target: { files: [file] } });
	const convert = screen.getByRole<HTMLButtonElement>('button', { name: '逆再生用に変換' });
	await waitFor(() => expect(convert.disabled).toBe(false));
	await fireEvent.click(convert);
	await screen.findByText(/映像のみ逆順です/);
	expect(exec).toHaveBeenCalledTimes(2);
	expect(exec.mock.calls[0][0]).toContain('0:a:0');
	expect(exec.mock.calls[1][0]).toContain('-an');
	expect(screen.queryByText('映像・音声の両方を逆順にしています。')).toBeNull();
});
