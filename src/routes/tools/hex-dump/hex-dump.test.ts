import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import HexDump from './+page.svelte';

describe('Hexダンプ', () => {
	it('ファイル選択後に行幅と最大表示バイト数をそれぞれ1回の変更で反映する', async () => {
		const { container } = render(HexDump);
		const upload = container.querySelector<HTMLInputElement>('#hex-file-input')!;
		const bytes = new Uint8Array(1027);
		const file = new File([bytes], 'binary.bin');
		vi.spyOn(file, 'slice').mockImplementation((start, end) =>
			Object.assign(new Blob(), { arrayBuffer: async () => bytes.slice(start, end).buffer })
		);
		await fireEvent.change(upload, { target: { files: [file] } });
		const rows = () => container.querySelectorAll('.hex-line');
		await waitFor(() => expect(rows()[0].querySelectorAll('.hex-byte')).toHaveLength(16));
		await fireEvent.change(screen.getByLabelText('1行あたりのバイト数'), {
			target: { value: '8' }
		});
		await waitFor(() => expect(rows()[0].querySelectorAll('.hex-byte')).toHaveLength(8));
		await fireEvent.change(screen.getByLabelText('最大表示バイト数'), {
			target: { value: '1024' }
		});
		expect(await screen.findByText('... (残り 3 バイトは省略されました)')).toBeTruthy();
		expect(container.querySelectorAll('.hex-byte')).toHaveLength(1024);
	});

	it('読み込み中のファイルをクリアしても内容が復活しない', async () => {
		const { container } = render(HexDump);
		const upload = container.querySelector<HTMLInputElement>('#hex-file-input')!;
		let finishRead!: (bytes: ArrayBuffer) => void;
		const read = new Promise<ArrayBuffer>((resolve) => {
			finishRead = resolve;
		});
		const file = new File(['old'], 'old.txt');
		vi.spyOn(file, 'slice').mockReturnValue(Object.assign(new Blob(), { arrayBuffer: () => read }));
		await fireEvent.change(upload, { target: { files: [file] } });
		await fireEvent.click(screen.getByRole('button', { name: 'クリア' }));
		finishRead(new TextEncoder().encode('old').buffer as ArrayBuffer);
		await read;
		expect(container.querySelector('.hex-line')).toBeNull();
		expect(screen.queryByText('old.txt')).toBeNull();
	});

	it('表示行数を制限し、最後のページからも全バイトをコピーできる', async () => {
		const { container } = render(HexDump);
		const upload = container.querySelector<HTMLInputElement>('#hex-file-input')!;
		const bytes = Uint8Array.from({ length: 2053 }, (_, index) => index % 256);
		const file = new File([bytes], 'pages.bin');
		vi.spyOn(file, 'slice').mockReturnValue(
			Object.assign(new Blob(), { arrayBuffer: async () => bytes.buffer })
		);
		const writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
		const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
		Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
		try {
			await fireEvent.change(screen.getByLabelText('1行あたりのバイト数'), {
				target: { value: '8' }
			});
			await fireEvent.change(upload, { target: { files: [file] } });
			expect(await screen.findByText('1 / 3 ページ')).toBeTruthy();
			const offsets = () => [...container.querySelectorAll('.hex-line > :first-child')];
			expect(offsets()).toHaveLength(128);
			expect(offsets()[0].textContent).toBe('00000000:');

			await fireEvent.click(screen.getByRole('button', { name: '次へ' }));
			expect(offsets()[0].textContent).toBe('00000400:');
			await fireEvent.click(screen.getByRole('button', { name: '最後' }));
			expect(offsets().map((item) => item.textContent)).toEqual(['00000800:']);
			expect(container.querySelectorAll('.hex-byte')).toHaveLength(5);
			await fireEvent.click(screen.getByRole('button', { name: '全ページをコピー' }));
			const dump = writeText.mock.calls[0][0];
			const copiedBytes = dump
				.split('\n')
				.map((line) => line.slice(10, 29).replaceAll(' ', ''))
				.join('');
			expect(copiedBytes).toBe(Buffer.from(bytes).toString('hex'));

			await fireEvent.click(screen.getByRole('button', { name: '先頭' }));
			expect(offsets()[0].textContent).toBe('00000000:');
		} finally {
			if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard);
			else Reflect.deleteProperty(navigator, 'clipboard');
		}
	});
});
