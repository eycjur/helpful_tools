import { describe, expect, it } from 'vitest';
import { getCleanFileName } from './metadata-cleaner';

describe('getCleanFileName', () => {
	it('uses the encoded format when Canvas changes the format', () => {
		expect(getCleanFileName('still.gif', 'no_meta', 'image/jpeg')).toBe('still_no_meta.jpg');
		expect(getCleanFileName('photo.webp', 'no_meta', 'image/png')).toBe('photo_no_meta.png');
	});

	it('keeps the original extension when it matches the encoded format', () => {
		expect(getCleanFileName('test.photo.JPEG', 'no_c2pa', 'image/jpeg')).toBe(
			'test.photo_no_c2pa.JPEG'
		);
		expect(getCleanFileName('photo', 'no_meta', 'image/png')).toBe('photo_no_meta.png');
	});
});
