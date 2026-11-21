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

		it('補助平面の数値参照と名前付き参照をデコードする', () => {
			expect(decodeHTMLEntity('&#128512; &#X1F600; &hearts;')).toBe('😀 😀 ♥');
			expect(decodeHTMLEntity('&#0; &#x110000;')).toBe('� �');
		});

		it('文字参照は一段だけデコードし、タグと改行は文字のまま保持する', () => {
			expect(decodeHTMLEntity('<b>&amp;lt; &#38;lt;</b>\r\n&lt;b&gt;')).toBe(
				'<b>&lt; &lt;</b>\r\n<b>'
			);
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

		it('元のBOMを保持し、不正なUTF-8はエラーにする', () => {
			expect(decodeBase64('77u/QQ==')).toBe('\uFEFFA');
			expect(() => decodeBase64('/w==')).toThrow();
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

		it('6桁の後の16進文字とCSSで空白ではない文字を残す', () => {
			expect(decodeUnicodeCSS('\\000041f\\41\u00a0x')).toBe('AfA\u00a0x');
		});

		it('CRLFを1つの空白として消費し、不正なコードポイントは置換文字にする', () => {
			expect(decodeUnicodeCSS('\\41\r\nx\\0\\D800\\110000')).toBe('Ax���');
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

		it('先頭が4以上の場合は2桁だけを消費する', () => {
			expect(decodeOctalJS('\\377\\400\\777')).toBe('ÿ 0?7');
		});
	});

	describe('JSON文字列 decode', () => {
		it('JSON文字列をデコードできる', () => {
			expect(decodeJSONString('"Hello\\nWorld"')).toBe('Hello\nWorld');
		});

		it('無効なJSONはエラーになる', () => {
			expect(() => decodeJSONString('"unterminated')).toThrow();
		});

		it.each(['{}', '[]', 'null', 'false', '42'])('文字列以外のJSON（%s）はエラーになる', (json) => {
			expect(() => decodeJSONString(json)).toThrow('JSON文字列のデコードに失敗');
		});
	});

	describe('Punycode decode', () => {
		it('Punycodeをデコードできる', () => {
			expect(decodePunycode('xn--bcher-kva')).toBe('bücher');
		});

		it('通常のラベルや大文字の接頭辞を含むドメインをデコードする', () => {
			expect(decodePunycode('www.XN--bcher-kva.de')).toBe('www.bücher.de');
		});

		it('Punycode形式でない場合はエラー', () => {
			expect(() => decodePunycode('example.com')).toThrow();
		});
	});

	describe('Base58 decode', () => {
		it('Base58をデコードできる', () => {
			expect(decodeBase58('1')).toBe('0x00');
			expect(decodeBase58('2')).toBe('0x01');
			expect(decodeBase58('112')).toBe('0x000001');
			expect(decodeBase58('StV1DL6CwTryKyV')).toBe('0x68656c6c6f20776f726c64');
		});

		it('無効な文字はエラー', () => {
			expect(() => decodeBase58('0')).toThrow();
			expect(() => decodeBase58('z'.repeat(18) + '0')).toThrow();
		});

		it('ブロックの境界で桁や先頭のゼロバイトを失わない', () => {
			for (const digits of [8, 9, 10, 17, 18, 19, 35, 36, 37]) {
				const hex = (58n ** BigInt(digits) - 1n).toString(16);
				const bytes = hex.length % 2 ? '0' + hex : hex;
				expect(decodeBase58('11' + 'z'.repeat(digits))).toBe('0x0000' + bytes);
			}
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
			expect(decodeMorse('.... . constructor')).toBe('HE?');
		});
	});

	describe('Binary/Decimal/Hex/Octal num decode', () => {
		it('8ビット2進数をデコードできる', () => {
			expect(decodeBinary('0100100001101001')).toBe('Hi');
			expect(decodeBinary('01001000 01101001')).toBe('Hi');
		});

		it('無効な2進数はエラー', () => {
			expect(() => decodeBinary('101')).toThrow();
			expect(() => decodeBinary('01001000 0110x')).toThrow();
			expect(() => decodeBinary('01001000 1')).toThrow();
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

		it('補助平面の文字コードをデコードする', () => {
			expect(decodeDecimal('128512')).toBe('😀');
			expect(decodeHexNum('0x1f600')).toBe('😀');
			expect(decodeOctalNum('373000')).toBe('😀');
		});

		it('数字の後ろに不正な文字がある場合や範囲外の値はエラーになる', () => {
			expect(() => decodeDecimal('65x')).toThrow();
			expect(() => decodeHexNum('41g')).toThrow();
			expect(() => decodeOctalNum('108')).toThrow();
			expect(() => decodeHexNum('110000')).toThrow();
		});
	});

	describe('Quoted-Printable decode', () => {
		it('Quoted-Printableをデコードできる', () => {
			expect(decodeQuotedPrintable('Hello=20World=21')).toBe('Hello World!');
		});

		it('soft line breakを除去できる', () => {
			expect(decodeQuotedPrintable('Hello=\nWorld')).toBe('HelloWorld');
		});

		it('エンコードされた等号の直後の改行は保持する', () => {
			expect(decodeQuotedPrintable('x=3D\r\ny')).toBe('x=\r\ny');
		});

		it('UTF-8の日本語や絵文字をデコードし、元からある文字は保持する', () => {
			expect(decodeQuotedPrintable('日本語:=E3=81=82 =F0=9F=98=80')).toBe('日本語:あ 😀');
		});

		it('ソフト改行で分かれたUTF-8のバイト列をデコードする', () => {
			expect(decodeQuotedPrintable('=E3=\r\n=81=82')).toBe('あ');
		});

		it.each(['=FF', '=E3=81'])('不正なUTF-8（%s）はエラーになる', (input) => {
			expect(() => decodeQuotedPrintable(input)).toThrow('UTF-8');
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

		it('末尾に改行があるUUencodeをデコードする', () => {
			expect(decodeUUencode('begin 644 cat.txt\r\n#0V%T\r\n`\r\nend\r\n')).toBe('Cat');
		});

		it('途切れたデータ行はエラーになる', () => {
			expect(() => decodeUUencode('begin 644 cat.txt\n#0V\n`\nend')).toThrow();
		});
	});
});
