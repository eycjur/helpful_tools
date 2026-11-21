import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import CurlBuilder from './+page.svelte';

describe('curlビルダー', () => {
	it('フォームの名前と値をURLエンコードする', async () => {
		const { container } = render(CurlBuilder);
		await fireEvent.click(screen.getByRole('button', { name: 'フォームデータ' }));
		const key = screen.getAllByPlaceholderText('key')[0];
		await fireEvent.input(key, { target: { value: 'na&me' } });
		await fireEvent.input(within(key.parentElement!).getByPlaceholderText('value'), {
			target: { value: 'あ &+=!' }
		});
		const command = container.querySelector('pre')?.textContent;
		expect(command).toContain(
			"--data-raw 'na%26me=%E3%81%82+%26%2B%3D%21&email=john%40example.com'"
		);
		expect(command).not.toContain('application/json');
	});

	it('RawとURLをリテラルとして渡し、HEAD選択時はボディを送らない', async () => {
		const { container } = render(CurlBuilder);
		const url = "https://example.com/?a=$example&b=o'neil";
		await fireEvent.input(screen.getByPlaceholderText('https://api.example.com/endpoint'), {
			target: { value: url }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Raw' }));
		await fireEvent.input(screen.getByLabelText('Raw データ'), { target: { value: '@name\n ' } });
		const command = () => container.querySelector('pre')?.textContent;
		expect(command()).toContain('-X GET');
		expect(command()).toContain("--data-raw '@name\n '");
		expect(command()).toContain("--url 'https://example.com/?a=$example&b=o'\\''neil'");
		await fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'HEAD' } });
		expect(command()).toContain('-I --url');
		expect(command()).not.toContain('--data-raw');
		expect(command()).not.toContain('-X HEAD');
	});
});
