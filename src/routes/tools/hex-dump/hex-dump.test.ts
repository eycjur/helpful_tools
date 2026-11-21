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
});
