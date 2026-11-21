import { describe, expect, it } from 'vitest';
import { getQrCodeUrl } from './qrcode';

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
