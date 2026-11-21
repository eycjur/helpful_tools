import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import PasswordGenerator from './+page.svelte';

describe('パスワード生成器', () => {
	it('範囲外・空欄・小数を弾き、最大値で再生成できる', async () => {
		const { container } = render(PasswordGenerator);
		const length = screen.getByRole('spinbutton', { name: 'パスワードの長さ' });
		for (const value of ['3', '21', '', '4.5']) {
			await fireEvent.input(length, { target: { value } });
			expect(screen.queryByText('生成されたパスワード')).toBeNull();
			expect(screen.getByRole<HTMLButtonElement>('button', { name: '再生成' }).disabled).toBe(true);
		}
		await fireEvent.input(length, { target: { value: '20' } });
		const passwords = [...container.querySelectorAll('.font-mono.text-lg')].map((element) =>
			(element.textContent ?? '').trim()
		);
		expect(passwords.map((password) => password.length)).toEqual([20, 20, 20, 20, 20]);
		expect(passwords.every((password) => !/[O0Il1]/.test(password))).toBe(true);
	});

	it('すべての文字種を解除すると古い結果が消える', async () => {
		render(PasswordGenerator);
		expect(screen.getByText('生成されたパスワード')).toBeTruthy();
		for (const checkbox of screen.getAllByRole('checkbox').slice(0, 4)) {
			await fireEvent.click(checkbox);
		}
		expect(screen.getByText('少なくとも1つの文字種を選択してください')).toBeTruthy();
		expect(screen.queryByText('生成されたパスワード')).toBeNull();
	});
});
