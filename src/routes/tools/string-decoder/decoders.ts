/**
 * エンコード文字列デコーダ - デコーダー関数
 */

import { toUnicode } from 'punycode/';

export function decodeURL(text: string): string {
	try {
		return decodeURIComponent(text);
	} catch {
		throw new Error('URLデコードに失敗');
	}
}

export function decodeHTMLEntity(text: string): string {
	let decoded = text;

	// 数値文字参照（10進数）
	decoded = decoded.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));

	// 数値文字参照（16進数）
	decoded = decoded.replace(/&#x([a-fA-F0-9]+);/g, (_, hex) =>
		String.fromCharCode(parseInt(hex, 16))
	);

	// 名前付き文字参照
	const entityMap: Record<string, string> = {
		'&amp;': '&',
		'&lt;': '<',
		'&gt;': '>',
		'&quot;': '"',
		'&#39;': "'",
		'&#x27;': "'",
		'&apos;': "'",
		'&#x2F;': '/',
		'&#x60;': '`',
		'&#x3D;': '=',
		'&nbsp;': '\u00A0',
		'&copy;': '©',
		'&reg;': '®',
		'&trade;': '™'
	};

	for (const [entity, char] of Object.entries(entityMap)) {
		decoded = decoded.replaceAll(entity, char);
	}

	return decoded;
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
		return JSON.parse(text);
	} catch {
		throw new Error('JSON文字列のデコードに失敗');
	}
}

export function decodePunycode(text: string): string {
	try {
		if (!text.startsWith('xn--')) {
			throw new Error('Punycode形式ではありません');
		}
		return toUnicode(text);
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
	const bytes = text.match(/[01]{8}/g);
	if (!bytes) {
		throw new Error('8ビット単位のバイナリではありません');
	}
	return bytes.map((b) => String.fromCharCode(parseInt(b, 2))).join('');
}

export function decodeOctalNum(text: string): string {
	const nums = text.trim().split(/\s+/);
	return nums.map((n) => String.fromCharCode(parseInt(n, 8))).join('');
}

export function decodeDecimal(text: string): string {
	const nums = text.trim().split(/\s+/);
	return nums.map((n) => String.fromCharCode(parseInt(n, 10))).join('');
}

export function decodeHexNum(text: string): string {
	const nums = text.trim().split(/\s+/);
	return nums.map((n) => String.fromCharCode(parseInt(n, 16))).join('');
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
	return text
		.replace(/=([A-F0-9]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
		.replace(/=\r?\n/g, '');
}

export function decodeUUencode(text: string): string {
	const lines = text.split('\n');
	if (!lines[0]?.startsWith('begin ') || !lines[lines.length - 1]?.trim().startsWith('end')) {
		throw new Error('UUencode形式ではありません');
	}

	let result = '';
	for (let i = 1; i < lines.length - 1; i++) {
		const line = lines[i];
		if (!line) continue;

		const length = (line.charCodeAt(0) - 32) & 0x3f;
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
