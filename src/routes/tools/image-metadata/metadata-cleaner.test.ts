// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getCleanFileName, removeC2paMetadata, removeJpegC2pa } from './metadata-cleaner';

function app11(payload: Buffer) {
	const header = Buffer.from([0xff, 0xeb, 0, 0]);
	header.writeUInt16BE(payload.length + 2, 2);
	return Buffer.concat([header, payload]);
}

describe('removeJpegC2pa', () => {
	it('removes the C2PA packets and preserves unrelated APP11 and EXIF segments', async () => {
		const soi = Buffer.from('ffd8', 'hex');
		const eoi = Buffer.from('ffd9', 'hex');
		const exif = Buffer.from('ffe10008457869660000', 'hex');
		const ordinaryApp11 = app11(
			Buffer.concat([Buffer.from('4a50000900000001', 'hex'), Buffer.alloc(40)])
		);
		const box = '0000002a6a756d62'; // jumb
		const description = '0000001e6a756d646332706100110010800000aa00389b71036332706100';
		const c2paStart = app11(Buffer.from('4a50000400000001' + box + description, 'hex'));
		const c2paEnd = app11(Buffer.from('4a50000400000002' + box + '00010203', 'hex'));
		const file = new File([soi, c2paStart, c2paEnd, ordinaryApp11, exif, eoi], 'photo.jpg', {
			type: 'image/jpeg'
		});
		const result = await removeJpegC2pa(file);
		expect(Buffer.from(await result.arrayBuffer())).toEqual(
			Buffer.concat([soi, ordinaryApp11, exif, eoi])
		);
	});

	it('returns the original JPEG when APP11 does not contain C2PA', async () => {
		const file = new File(
			[Buffer.from('ffd8', 'hex'), app11(Buffer.alloc(40)), Buffer.from('ffd9', 'hex')],
			'photo.jpg',
			{
				type: 'image/jpeg'
			}
		);
		expect(await removeJpegC2pa(file)).toBe(file);
	});
});

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

it('refuses C2PA-only removal for a WebP file', async () => {
	const file = new File(['test'], 'photo.webp', { type: 'image/webp' });
	await expect(removeC2paMetadata(file)).rejects.toThrow('C2PAのみ削除できる形式はJPEGとPNGです');
});
