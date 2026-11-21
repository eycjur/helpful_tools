import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ClipboardInspector from './+page.svelte';

function setClipboard(clipboard: {
	read: () => Promise<unknown>;
	writeText?: (text: string) => Promise<void>;
}) {
	Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard });
}

afterEach(() => {
	Reflect.deleteProperty(navigator, 'clipboard');
});

describe('クリップボード検査', () => {
	it('複数のアイテムに同じMIMEタイプがあっても、すべて表示する', async () => {
		setClipboard({
			read: async () => [
				{ types: ['text/plain'], getType: async () => ({ text: async () => 'first' }) },
				{ types: ['text/plain'], getType: async () => ({ text: async () => 'second' }) }
			]
		});
		render(ClipboardInspector);
		await fireEvent.click(screen.getByRole('button', { name: 'クリップボードを読み取る' }));
		const fields = await screen.findAllByRole<HTMLTextAreaElement>('textbox');
		expect(fields.map((field) => field.value)).toEqual(['first', 'second']);
	});

	it('空白だけのテキストをそのままコピーできる', async () => {
		const writeText = vi.fn(async () => {});
		setClipboard({
			read: async () => [
				{ types: ['text/plain'], getType: async () => ({ text: async () => ' \t' }) }
			],
			writeText
		});
		render(ClipboardInspector);
		await fireEvent.click(screen.getByRole('button', { name: 'クリップボードを読み取る' }));
		await fireEvent.click(await screen.findByRole('button', { name: 'コピー' }));
		expect(writeText).toHaveBeenCalledWith(' \t');
	});
});
