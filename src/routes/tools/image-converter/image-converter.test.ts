import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Page from './+page.svelte';

function renderConverter() {
	vi.stubGlobal(
		'URL',
		class extends URL {
			static createObjectURL = vi.fn((blob: Blob) => `blob:${(blob as File).name ?? blob.type}`);
			static revokeObjectURL = vi.fn();
		}
	);
	const { container } = render(Page);
	const input = container.querySelector('input[type="file"]')!;
	return (name: string) =>
		fireEvent.change(input, {
			target: { files: [new File(['file'], name, { type: 'image/png' })] }
		});
}

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('画像形式変換', () => {
	it('shows a message when neither decoder can open the image', async () => {
		vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('invalid image')));
		vi.stubGlobal(
			'Image',
			class {
				onerror?: () => void;
				set src(_url: string) {
					queueMicrotask(() => this.onerror?.());
				}
			}
		);
		const select = renderConverter();
		await select('broken.png');
		expect((await screen.findByRole('alert')).textContent).toContain(
			'画像の読み込みに失敗しました'
		);
		expect(screen.queryByRole('button', { name: 'DL' })).toBeNull();
	});

	it('discards a result from an image replaced before encoding finishes', async () => {
		const close = vi.fn();
		vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 4, height: 4, close }));
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
			drawImage: vi.fn(),
			save: vi.fn(),
			fillRect: vi.fn(),
			restore: vi.fn()
		} as unknown as CanvasRenderingContext2D);
		let completeOld: () => void = () => {};
		const toBlob = vi
			.spyOn(HTMLCanvasElement.prototype, 'toBlob')
			.mockImplementation((callback, type) => {
				queueMicrotask(() => callback(new Blob(['new'], { type })));
			});
		toBlob.mockImplementationOnce((callback, type) => {
			completeOld = () => callback(new Blob(['old'], { type }));
		});
		const select = renderConverter();
		await select('old.png');
		await waitFor(() => expect(toBlob).toHaveBeenCalledTimes(1));
		await select('new.png');
		await waitFor(() => expect(screen.getAllByRole('button', { name: 'DL' })).toHaveLength(3));
		completeOld();
		await waitFor(() => expect(close).toHaveBeenCalledTimes(2));
		expect(screen.getAllByRole('button', { name: 'DL' })).toHaveLength(3);
		expect(toBlob).toHaveBeenCalledTimes(4);
	});
});
