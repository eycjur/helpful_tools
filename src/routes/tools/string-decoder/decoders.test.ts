import { describe, it, expect } from 'vitest';
import {
	decodeURL,
	decodeHTMLEntity,
	decodeBase64,
	decodeUnicodeJS,
	decodeUnicodeCSS,
	decodeUnicodeCodePoint,
	decodeHexJS,
	decodeOctalJS,
	decodeJSONString,
	decodePunycode,
	decodeBase58,
	decodeROT13,
	decodeBinary,
	decodeOctalNum,
	decodeDecimal,
	decodeHexNum,
	decodeMorse,
	decodeQuotedPrintable,
	decodeUUencode
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

	describe('Unicode CSS decode', () => {
		it('CSSのUnicodeエスケープをデコードできる', () => {
			expect(decodeUnicodeCSS('\\0048\\0065\\006C\\006C\\006F')).toBe('Hello');
		});
	});

	describe('Unicode CodePoint decode', () => {
		it('\\u{...}形式をデコードできる', () => {
			expect(decodeUnicodeCodePoint('\\u{1F600}')).toBe('😀');
		});
	});

	describe('Hex JS-style decode', () => {
		it('\\xXX形式のエスケープをデコードできる', () => {
			expect(decodeHexJS('\\x48\\x65\\x6C\\x6C\\x6F')).toBe('Hello');
		});
	});

	describe('Octal JS-style decode', () => {
		it('\\NNN形式のエスケープをデコードできる', () => {
			expect(decodeOctalJS('\\110\\145\\154\\154\\157')).toBe('Hello');
		});
	});

	describe('JSON文字列 decode', () => {
		it('JSON文字列をデコードできる', () => {
			expect(decodeJSONString('"Hello\\nWorld"')).toBe('Hello\nWorld');
		});

		it('無効なJSONはエラーになる', () => {
			expect(() => decodeJSONString('"unterminated')).toThrow();
		});
	});

	describe('Punycode decode', () => {
		it('Punycodeをデコードできる', () => {
			expect(decodePunycode('xn--bcher-kva')).toBe('bücher');
		});

		it('Punycode形式でない場合はエラー', () => {
			expect(() => decodePunycode('example.com')).toThrow();
		});
	});

	describe('Base58 decode', () => {
		it('Base58をデコードできる', () => {
			expect(decodeBase58('1')).toBe('0x0');
			expect(decodeBase58('2')).toBe('0x1');
		});

		it('無効な文字はエラー', () => {
			expect(() => decodeBase58('0')).toThrow();
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

	describe('Binary/Decimal/Hex/Octal num decode', () => {
		it('8ビット2進数をデコードできる', () => {
			expect(decodeBinary('0100100001101001')).toBe('Hi');
		});

		it('無効な2進数はエラー', () => {
			expect(() => decodeBinary('101')).toThrow();
		});

		it('10進数をデコードできる', () => {
			expect(decodeDecimal('72 101 108 108 111')).toBe('Hello');
		});

		it('16進数をデコードできる', () => {
			expect(decodeHexNum('48 65 6c 6c 6f')).toBe('Hello');
		});

		it('8進数をデコードできる', () => {
			expect(decodeOctalNum('141 142')).toBe('ab');
		});
	});

	describe('Quoted-Printable decode', () => {
		it('Quoted-Printableをデコードできる', () => {
			expect(decodeQuotedPrintable('Hello=20World=21')).toBe('Hello World!');
		});

		it('soft line breakを除去できる', () => {
			expect(decodeQuotedPrintable('Hello=\nWorld')).toBe('HelloWorld');
		});
	});

	describe('UUencode decode', () => {
		it('空のUUencodeをデコードできる', () => {
			const input = 'begin 644 empty.txt\n`\nend';
			expect(decodeUUencode(input)).toBe('');
		});

		it('UUencode形式でない場合はエラー', () => {
			expect(() => decodeUUencode('not uuencode')).toThrow();
		});
	});
});
