/**
 * エンコード文字列デコーダ - デコーダー関数
 */

import { toUnicode } from 'punycode';
export { decodeHtmlEntities as decodeHTMLEntity } from '../_shared/html-entities';

export function decodeURL(text: string): string {
	try {
		return decodeURIComponent(text);
	} catch {
		throw new Error('URLデコードに失敗');
	}
}

export function decodeBase64(text: string): string {
	try {
		const binaryStr = atob(text.trim());
		const bytes = Uint8Array.from(binaryStr, (c) => c.charCodeAt(0));
		return new TextDecoder('utf-8').decode(bytes);
	} catch {
		throw new Error('Base64デコードに失敗');
	}
}

export function decodeUnicodeJS(text: string): string {
	return text.replace(/\\u([a-fA-F0-9]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export function decodeUnicodeCSS(text: string): string {
	return text.replace(/\\([a-fA-F0-9]{1,6})(?:\s|$|(?=[^a-fA-F0-9]))/g, (_, hex) =>
		String.fromCodePoint(parseInt(hex, 16))
	);
}

export function decodeUnicodeCodePoint(text: string): string {
	return text.replace(/\\u\{([a-fA-F0-9]+)\}/g, (_, hex) =>
		String.fromCodePoint(parseInt(hex, 16))
	);
}

export function decodeHexJS(text: string): string {
	return text.replace(/\\x([a-fA-F0-9]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export function decodeOctalJS(text: string): string {
	return text.replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

export function decodeJSONString(text: string): string {
	try {
		const value: unknown = JSON.parse(text);
		if (typeof value === 'string') return value;
	} catch {
		// 構文エラーと文字列以外のJSONは同じメッセージを表示する。
	}
	throw new Error('JSON文字列のデコードに失敗');
}

export function decodePunycode(text: string): string {
	try {
		const domain = text.trim().replace(/[\u3002\uff0e\uff61]/g, '.');
		if (!/(?:^|\.)xn--[a-z0-9-]+(?:\.|$)/i.test(domain)) {
			throw new Error('Punycode形式ではありません');
		}
		return toUnicode(domain.replace(/(^|\.)xn--/gi, '$1xn--'));
	} catch {
		throw new Error('Punycodeデコードに失敗');
	}
}

export function decodeBase58(text: string): string {
	const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

	let result = 0n;
	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		const value = alphabet.indexOf(char);
		if (value === -1) {
			throw new Error('無効なBase58文字');
		}
		result = result * 58n + BigInt(value);
	}

	return '0x' + result.toString(16);
}

export function decodeROT13(text: string): string {
	return text.replace(/[a-zA-Z]/g, (char) => {
		const base = char <= 'Z' ? 65 : 97;
		return String.fromCharCode(((char.charCodeAt(0) - base + 13) % 26) + base);
	});
}

export function decodeBinary(text: string): string {
	const bits = text.replace(/\s/g, '');
	if (bits.length % 8 !== 0 || !/^[01]+$/.test(bits)) {
		throw new Error('8ビット単位のバイナリではありません');
	}
	return bits.replace(/[01]{8}/g, (byte) => String.fromCharCode(parseInt(byte, 2)));
}

function decodeCharacterCodes(text: string, radix: number, pattern: RegExp): string {
	return text
		.trim()
		.split(/\s+/)
		.map((token) => {
			if (!pattern.test(token)) throw new Error('不正な文字コードが含まれています');
			const codePoint = parseInt(token, radix);
			if (codePoint > 0x10ffff) throw new Error('Unicodeコードポイントの範囲外です');
			return String.fromCodePoint(codePoint);
		})
		.join('');
}

export function decodeOctalNum(text: string): string {
	return decodeCharacterCodes(text, 8, /^\+?[0-7]+$/);
}

export function decodeDecimal(text: string): string {
	return decodeCharacterCodes(text, 10, /^\+?\d+$/);
}

export function decodeHexNum(text: string): string {
	return decodeCharacterCodes(text, 16, /^\+?(?:0x)?[0-9a-f]+$/i);
}

export function decodeMorse(text: string): string {
	const morseToChar: Record<string, string> = {
		'.-': 'A',
		'-...': 'B',
		'-.-.': 'C',
		'-..': 'D',
		'.': 'E',
		'..-.': 'F',
		'--.': 'G',
		'....': 'H',
		'..': 'I',
		'.---': 'J',
		'-.-': 'K',
		'.-..': 'L',
		'--': 'M',
		'-.': 'N',
		'---': 'O',
		'.--.': 'P',
		'--.-': 'Q',
		'.-.': 'R',
		'...': 'S',
		'-': 'T',
		'..-': 'U',
		'...-': 'V',
		'.--': 'W',
		'-..-': 'X',
		'-.--': 'Y',
		'--..': 'Z',
		'.----': '1',
		'..---': '2',
		'...--': '3',
		'....-': '4',
		'.....': '5',
		'-....': '6',
		'--...': '7',
		'---..': '8',
		'----.': '9',
		'-----': '0'
	};

	return text
		.trim()
		.split(/\s+/)
		.map((code) => morseToChar[code] || '?')
		.join('');
}

export function decodeQuotedPrintable(text: string): string {
	const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
	return text.replace(/=\r?\n/g, '').replace(/(?:=[A-F0-9]{2})+/g, (encoded) => {
		const bytes = new Uint8Array(encoded.length / 3);
		for (let i = 0; i < bytes.length; i++) {
			const start = i * 3 + 1;
			bytes[i] = parseInt(encoded.slice(start, start + 2), 16);
		}

		try {
			return decoder.decode(bytes);
		} catch {
			throw new Error('Quoted-Printableに不正なUTF-8バイト列が含まれています');
		}
	});
}

export function decodeUUencode(text: string): string {
	const lines = text.trimEnd().split(/\r?\n/);
	if (!lines[0]?.startsWith('begin ') || lines[lines.length - 1]?.trim() !== 'end') {
		throw new Error('UUencode形式ではありません');
	}

	let result = '';
	for (let i = 1; i < lines.length - 1; i++) {
		const line = lines[i];
		if (!line) continue;

		const length = (line.charCodeAt(0) - 32) & 0x3f;
		if (!/^[ -`]+$/.test(line) || line.length - 1 < Math.ceil((length * 8) / 6)) {
			throw new Error('不正なUUencodeデータが含まれています');
		}
		let bytes = '';

		for (let j = 1; j < line.length; j++) {
			const val = (line.charCodeAt(j) - 32) & 0x3f;
			bytes += val.toString(2).padStart(6, '0');
		}

		for (let j = 0; j < length; j++) {
			const byte = parseInt(bytes.substring(j * 8, j * 8 + 8), 2);
			result += String.fromCharCode(byte);
		}
	}

	return result;
}
