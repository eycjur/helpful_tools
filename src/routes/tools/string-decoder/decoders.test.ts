import { describe, it, expect } from 'vitest';
import {
	decodeURL,
	decodeHTMLEntity,
	decodeBase64,
	decodeUnicodeJS,
	decodeHexJS,
	decodeROT13,
	decodeMorse
} from './decoders';

describe('エンコード文字列デコーダ - コアロジック', () => {
	describe('URL decode', () => {
		it('URLエンコードされた文字列をデコードできる', () => {
			expect(decodeURL('Hello%20World')).toBe('Hello World');
			expect(decodeURL('%E3%81%93%E3%82%93%E3%81%AB%E3%81%A1%E3%81%AF')).toBe('こんにちは');
		});

		it('特殊文字のURLエンコードをデコードできる', () => {
			expect(decodeURL('%21%40%23%24')).toBe('!@#$');
		});
	});

	describe('HTML Entity decode', () => {
		it('名前付き文字参照をデコードできる', () => {
			expect(decodeHTMLEntity('&lt;div&gt;')).toBe('<div>');
			expect(decodeHTMLEntity('&amp;&quot;&apos;')).toBe('&"\'');
		});

		it('数値文字参照（10進数）をデコードできる', () => {
			expect(decodeHTMLEntity('&#72;&#101;&#108;&#108;&#111;')).toBe('Hello');
		});

		it('数値文字参照（16進数）をデコードできる', () => {
			expect(decodeHTMLEntity('&#x48;&#x65;&#x6C;&#x6C;&#x6F;')).toBe('Hello');
		});
	});

	describe('Base64 decode', () => {
		it('Base64エンコードされた文字列をデコードできる', () => {
			expect(decodeBase64('SGVsbG8gV29ybGQ=')).toBe('Hello World');
		});

		it('日本語のBase64をデコードできる', () => {
			const encoded = btoa(unescape(encodeURIComponent('こんにちは')));
			expect(decodeBase64(encoded)).toBe('こんにちは');
		});
	});

	describe('Unicode JS-style decode', () => {
		it('\\uXXXX形式のエスケープをデコードできる', () => {
			expect(decodeUnicodeJS('\\u0048\\u0065\\u006C\\u006C\\u006F')).toBe('Hello');
		});

		it('日本語の\\uXXXX形式をデコードできる', () => {
			expect(decodeUnicodeJS('\\u3053\\u3093\\u306B\\u3061\\u306F')).toBe('こんにちは');
		});

		it('通常の文字と混在したエスケープをデコードできる', () => {
			expect(decodeUnicodeJS('Hello \\u4E16\\u754C')).toBe('Hello 世界');
		});
	});

	describe('Hex JS-style decode', () => {
		it('\\xXX形式のエスケープをデコードできる', () => {
			expect(decodeHexJS('\\x48\\x65\\x6C\\x6C\\x6F')).toBe('Hello');
		});
	});

	describe('ROT13 decode', () => {
		it('ROT13エンコードされた文字列をデコードできる', () => {
			expect(decodeROT13('Uryyb Jbeyq')).toBe('Hello World');
		});

		it('ROT13は双方向変換である', () => {
			const original = 'Test Message';
			const encoded = decodeROT13(original);
			const decoded = decodeROT13(encoded);
			expect(decoded).toBe(original);
		});

		it('英字以外の文字は変更しない', () => {
			expect(decodeROT13('Uryyb123!')).toBe('Hello123!');
		});
	});

	describe('Morse code decode', () => {
		it('モールス信号をデコードできる', () => {
			expect(decodeMorse('.... . .-.. .-.. ---')).toBe('HELLO');
		});

		it('複数のスペースは1つのスペースとして扱われる', () => {
			expect(decodeMorse('....  .  .-..  .-..  ---')).toBe('HELLO');
		});

		it('数字のモールス信号をデコードできる', () => {
			expect(decodeMorse('.---- ..--- ...-- ....- .....')).toBe('12345');
		});

		it('認識できないコードは?に変換される', () => {
			expect(decodeMorse('.... . invalid')).toBe('HE?');
		});
	});
});
