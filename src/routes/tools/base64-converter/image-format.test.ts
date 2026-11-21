import { describe, expect, it } from 'vitest';
import { detectBase64ImageMimeType, imageFileExtension } from './image-format';

describe('Base64画像の形式', () => {
	it.each([
		['\x89PNG\r\n\x1a\n', 'image/png'],
		['\xff\xd8\xff', 'image/jpeg'],
		['GIF87a', 'image/gif'],
		['GIF89a', 'image/gif'],
		['RIFF\0\0\0\0WEBP', 'image/webp']
	])('%s の画像形式を識別する', (header, mimeType) => {
		expect(detectBase64ImageMimeType(btoa(header))).toBe(mimeType);
	});

	it('改行が含まれるBase64を識別する', () => {
		expect(detectBase64ImageMimeType('R0lG\nODlh')).toBe('image/gif');
	});

	it('画像形式を識別できないときは undefined を返す', () => {
		expect(detectBase64ImageMimeType(btoa('RIFF\0\0\0\0WAVE'))).toBeUndefined();
	});

	it.each([
		['image/png', 'png'],
		['image/jpeg', 'jpg'],
		['image/gif', 'gif'],
		['image/webp', 'webp'],
		['image/svg+xml;charset=utf-8', 'svg']
	])('%s の拡張子を返す', (mimeType, extension) => {
		expect(imageFileExtension(mimeType)).toBe(extension);
	});
});
