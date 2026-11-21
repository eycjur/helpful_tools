import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Page from './+page.svelte';

const readers: TestReader[] = [];
const images: TestImage[] = [];
const writeText = vi.fn().mockResolvedValue(undefined);
const readClipboard = vi.fn<() => Promise<ClipboardItem[]>>();
const createObjectURL = vi.fn(() => 'blob:converted-image');
const revokeObjectURL = vi.fn();
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

class TestReader {
	onload: (() => void) | null = null;
	result: string | null = null;
	readAsDataURL = vi.fn();
	abort = vi.fn();

	constructor() {
		readers.push(this);
	}

	finish(result: string) {
		this.result = result;
		this.onload?.();
	}
}

class TestImage {
	onload: (() => void) | null = null;
	src = '';

	constructor() {
		images.push(this);
	}
}

async function chooseImage(container: HTMLElement, name: string) {
	const input = container.querySelector('input[type="file"]')!;
	await fireEvent.change(input, {
		target: { files: [new File(['image'], name, { type: 'image/png' })] }
	});
}

function clearButton() {
	return screen.getByRole('button', { name: 'すべてクリア' });
}

function pendingResult<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

describe('画像とBase64の変換中に入力を変更する', () => {
	beforeEach(() => {
		readers.length = 0;
		images.length = 0;
		vi.clearAllMocks();
		vi.stubGlobal('FileReader', TestReader);
		vi.stubGlobal('Image', TestImage);
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: { writeText, read: readClipboard }
		});
		vi.stubGlobal(
			'URL',
			class extends URL {
				static createObjectURL = createObjectURL;
				static revokeObjectURL = revokeObjectURL;
			}
		);
	});

	it('Data URLの大文字表記を画像として読み込む', async () => {
		render(Page);
		await fireEvent.click(screen.getByRole('button', { name: 'Base64 → 画像' }));
		const dataUrl = 'DATA:IMAGE/GIF;BASE64,R0lGODlhAQABAA';
		await fireEvent.input(screen.getByRole('textbox'), { target: { value: dataUrl } });
		await fireEvent.click(screen.getByRole('button', { name: '画像に変換' }));
		expect(images[0]?.src).toBe(dataUrl);
	});

	afterEach(() => {
		if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
		else Reflect.deleteProperty(navigator, 'clipboard');
		vi.unstubAllGlobals();
	});

	it('クリアの後に以前のファイル読み込み結果を自動コピーしない', async () => {
		const { container } = render(Page);
		await chooseImage(container, 'old.png');
		await fireEvent.click(clearButton());
		readers[0].finish('data:image/png;base64,OLD=');
		await tick();

		expect(writeText).not.toHaveBeenCalled();
		expect(readers[0].abort).toHaveBeenCalledOnce();
		expect(screen.queryByAltText('プレビュー')).toBeNull();
	});

	it('選び直したファイルの結果を古い読み込みで上書きしない', async () => {
		const { container } = render(Page);
		await chooseImage(container, 'old.png');
		await chooseImage(container, 'new.png');
		readers[1].finish('data:image/png;base64,NEW=');
		await tick();
		readers[0].finish('data:image/png;base64,OLD=');
		await tick();

		expect(screen.getByRole<HTMLTextAreaElement>('textbox').value).toBe(
			'data:image/png;base64,NEW='
		);
		expect(writeText.mock.calls).toEqual([['data:image/png;base64,NEW=']]);
	});

	it('画面を離れた後のクリップボード画像から読み込みを始めない', async () => {
		const pasted = pendingResult<ClipboardItem[]>();
		readClipboard.mockReturnValueOnce(pasted.promise);
		const { unmount } = render(Page);
		await fireEvent.click(screen.getByRole('button', { name: 'クリップボードから画像を読み込む' }));
		expect(readClipboard).toHaveBeenCalledOnce();
		await unmount();

		const blob = new Blob(['image'], { type: 'image/png' });
		pasted.resolve([
			{ presentationStyle: 'unspecified', types: ['image/png'], getType: async () => blob }
		]);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(createObjectURL).not.toHaveBeenCalled();
		expect(readers).toHaveLength(0);
	});

	it('画像のBlobを取得中にクリアしても後から結果が復活しない', async () => {
		const blob = new Blob(['image'], { type: 'image/png' });
		const oldBlob = pendingResult<Blob>();
		vi.stubGlobal(
			'fetch',
			vi
				.fn(async () => ({ blob: () => oldBlob.promise }))
				.mockResolvedValueOnce({
					blob: async () => blob
				})
		);
		render(Page);
		await fireEvent.click(screen.getByRole('button', { name: 'Base64 → 画像' }));
		const input = screen.getByRole('textbox');
		const convert = screen.getByRole('button', { name: '画像に変換' });
		await fireEvent.input(input, { target: { value: 'iVBORw0KGgo=' } });
		await fireEvent.click(convert);
		images[0].onload?.();
		await waitFor(() => expect(screen.getByAltText('変換結果')).toBeDefined());

		await fireEvent.input(input, { target: { value: 'R0lGODlh' } });
		await fireEvent.click(convert);
		images[1].onload?.();
		await fireEvent.click(clearButton());

		oldBlob.resolve(blob);
		await oldBlob.promise;
		await tick();
		expect(createObjectURL).toHaveBeenCalledOnce();
		expect(screen.queryByAltText('変換結果')).toBeNull();
	});

	it('Base64の入力を変えると新しい画像を変換でき、以前の画像の読み込み結果は無視する', async () => {
		const fetch = vi.fn().mockResolvedValue({
			blob: async () => new Blob(['image'], { type: 'image/gif' })
		});
		vi.stubGlobal('fetch', fetch);
		render(Page);
		await fireEvent.click(screen.getByRole('button', { name: 'Base64 → 画像' }));
		const input = screen.getByRole('textbox');
		const convert = screen.getByRole('button', { name: '画像に変換' });

		await fireEvent.input(input, { target: { value: 'iVBORw0KGgo=' } });
		await fireEvent.click(convert);
		await fireEvent.input(input, { target: { value: 'R0lGODlh' } });
		await fireEvent.click(convert);

		images[0].onload?.();
		expect(fetch).not.toHaveBeenCalled();
		images[1].onload?.();
		await waitFor(() => expect(screen.getByText('converted-image.gif')).toBeDefined());
		expect(fetch).toHaveBeenCalledExactlyOnceWith('data:image/gif;base64,R0lGODlh');
	});
});
