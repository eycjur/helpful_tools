import { fireEvent, render, screen } from '@testing-library/svelte';
import { expect, it, vi } from 'vitest';
import { loadQrCodeImage } from '../_shared/qrcode';
import Page from './+page.svelte';

vi.mock('../_shared/qrcode', async (importOriginal) => ({
	...(await importOriginal<typeof import('../_shared/qrcode')>()),
	loadQrCodeImage: vi.fn()
}));

it('preserves the validation message when toggling the icon for an invalid username', async () => {
	render(Page);
	const input = screen.getByLabelText('Xユーザー名');
	await fireEvent.input(input, { target: { value: '@bad-name' } });
	await fireEvent.click(screen.getByRole('checkbox'));
	expect(
		screen.getByText('ユーザー名は英数字とアンダースコアのみ、15文字以内で入力してください。')
	).toBeTruthy();
	expect(screen.queryByRole('button', { name: 'QRコードをダウンロード' })).toBeNull();
	expect(loadQrCodeImage).not.toHaveBeenCalled();
});
