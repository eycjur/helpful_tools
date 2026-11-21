import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadQrCodeImage } from '../_shared/qrcode';
import Page from './+page.svelte';

vi.mock('../_shared/qrcode', async (importOriginal) => ({
	...(await importOriginal<typeof import('../_shared/qrcode')>()),
	loadQrCodeImage: vi.fn()
}));

afterEach(() => vi.resetAllMocks());

describe('QRコード生成', () => {
	it('keeps an emoji at the 2,000-character boundary and rejects longer input', async () => {
		vi.mocked(loadQrCodeImage).mockResolvedValue(document.createElement('img'));
		render(Page);
		const input = screen.getByPlaceholderText('テキストを入力');
		const text = 'a'.repeat(1999) + '🙂';
		await fireEvent.input(input, { target: { value: text } });
		const qr = await screen.findByAltText('QRコード');
		expect(new URL((qr as HTMLImageElement).src).searchParams.get('data')).toBe(text);

		vi.mocked(loadQrCodeImage).mockClear();
		await fireEvent.input(input, { target: { value: text + 'b' } });
		expect(screen.getByText('入力は2000文字以内にしてください。')).toBeTruthy();
		expect(screen.queryByAltText('QRコード')).toBeNull();
		expect(loadQrCodeImage).not.toHaveBeenCalled();
	});

	it('ignores an earlier request that fails after the latest result', async () => {
		let rejectOld: (reason: Error) => void = () => {};
		vi.mocked(loadQrCodeImage).mockImplementation((url) => {
			if (new URL(url).searchParams.get('data') === 'first') {
				return new Promise((_, reject) => (rejectOld = reject));
			}
			return Promise.resolve(document.createElement('img'));
		});
		render(Page);
		const input = screen.getByPlaceholderText('テキストを入力');
		await fireEvent.input(input, { target: { value: 'first' } });
		await waitFor(() => expect(loadQrCodeImage).toHaveBeenCalled());
		await fireEvent.input(input, { target: { value: 'latest' } });
		await screen.findByAltText('QRコード');
		rejectOld(new Error('old request failed'));
		await Promise.resolve();
		expect(screen.queryByText('old request failed')).toBeNull();
		expect(screen.queryByAltText('QRコード')).toBeTruthy();
	});
});
