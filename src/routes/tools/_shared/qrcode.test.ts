import { afterEach, describe, expect, it, vi } from 'vitest';
import { getQrCodeUrl, loadQrCodeImage } from './qrcode';

afterEach(() => vi.unstubAllGlobals());

describe('getQrCodeUrl', () => {
	it('encodes Japanese, emoji and URL delimiters as one payload', () => {
		const text = 'https://example.test/?q=日本語+🙂&percent=%20 space';
		const url = new URL(getQrCodeUrl(text));
		expect(url.searchParams.get('data')).toBe(text);
		expect(url.searchParams.get('size')).toBe('600x600');
	});

	it('can encode input containing a lone surrogate', () => {
		const url = new URL(getQrCodeUrl('a\ud83d'));
		expect(url.searchParams.get('data')).toBe('a\ufffd');
	});
});

describe('loadQrCodeImage', () => {
	it.each([
		[600, 600, true],
		[200, 200, false],
		[600, 200, false]
	])('checks the decoded image size (%d × %d)', async (width, height, valid) => {
		vi.stubGlobal(
			'Image',
			class {
				naturalWidth = width;
				naturalHeight = height;
				onload?: () => void;

				set src(_url: string) {
					this.onload?.();
				}
			}
		);
		const image = loadQrCodeImage('https://example.test/qr.png');
		if (valid) {
			await expect(image).resolves.toMatchObject({ naturalWidth: 600, naturalHeight: 600 });
		} else {
			await expect(image).rejects.toThrow('QRコード画像の生成に失敗しました');
		}
	});
});
