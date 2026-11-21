import { webcrypto } from 'node:crypto';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HashCalculator from './+page.svelte';

afterEach(() => vi.unstubAllGlobals());

describe('ハッシュ計算', () => {
	it('空白だけのテキストをハッシュ化する', async () => {
		render(HashCalculator);
		await fireEvent.click(screen.getByRole('button', { name: 'テキスト' }));
		await fireEvent.input(screen.getByRole('textbox'), { target: { value: ' ' } });
		expect(await screen.findByText('7215ee9c7d9dc229d2921a40e899ec5f')).toBeTruthy();
	});

	it('古い読み込みが後で終わっても、新しいファイルの結果を表示する', async () => {
		vi.stubGlobal('crypto', webcrypto);
		const { container } = render(HashCalculator);
		const upload = container.querySelector<HTMLInputElement>('#hash-file-input')!;
		let finishOldRead!: (bytes: ArrayBuffer) => void;
		const oldRead = new Promise<ArrayBuffer>((resolve) => {
			finishOldRead = resolve;
		});
		const oldFile = Object.assign(new File(['old'], 'old.txt'), {
			arrayBuffer: () => oldRead
		});
		const newFile = Object.assign(new File(['new'], 'new.txt'), {
			arrayBuffer: async () => new TextEncoder().encode('new').buffer
		});
		await fireEvent.change(upload, { target: { files: [oldFile] } });
		await fireEvent.change(upload, { target: { files: [newFile] } });
		expect(await screen.findByText('22af645d1859cb5ca6da0c484f1f37ea')).toBeTruthy();
		finishOldRead(new TextEncoder().encode('old').buffer as ArrayBuffer);
		await oldRead;
		expect(screen.queryByText('149603e6c03516362a8da23f624db945')).toBeNull();
		expect(screen.getByText('new.txt')).toBeTruthy();
	});
});
