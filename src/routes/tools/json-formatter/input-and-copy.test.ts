import { fireEvent, render, screen } from '@testing-library/svelte';
import { expect, it, vi } from 'vitest';
import Page from './+page.svelte';

it('UTF-8で1 MiBまで受け付ける', async () => {
	const { getByRole } = render(Page);
	const input = getByRole('textbox');
	const limit = 1_048_576;
	const japanese = 'あ'.repeat(Math.floor((limit - 2) / 3));
	const valid = '"' + japanese + '"' + ' '.repeat((limit - 2) % 3);
	await fireEvent.input(input, { target: { value: valid } });
	expect(screen.getByText('解析成功')).toBeTruthy();
	await fireEvent.input(input, { target: { value: valid + ' ' } });
	expect(screen.getByText(/入力サイズが大きすぎます/)).toBeTruthy();
});

it('旧式のコピーで10万文字を超えるJSON全体を選択する', async () => {
	const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
	const execCommand = Object.getOwnPropertyDescriptor(document, 'execCommand');
	const value = '"' + 'x'.repeat(120_000) + '"';
	const copy = vi.fn(() => {
		const source = document.body.querySelector<HTMLTextAreaElement>(':scope > textarea')!;
		expect(source.value.slice(source.selectionStart, source.selectionEnd)).toBe(value);
		return true;
	});

	try {
		Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
		Object.defineProperty(document, 'execCommand', { configurable: true, value: copy });
		render(Page);
		await fireEvent.input(screen.getByRole('textbox'), { target: { value } });
		await fireEvent.click(screen.getByRole('button', { name: 'コピー' }));
		expect(copy).toHaveBeenCalledWith('copy');
		expect(copy).toHaveReturnedWith(true);
	} finally {
		if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard);
		else Reflect.deleteProperty(navigator, 'clipboard');
		if (execCommand) Object.defineProperty(document, 'execCommand', execCommand);
		else Reflect.deleteProperty(document, 'execCommand');
	}
});
