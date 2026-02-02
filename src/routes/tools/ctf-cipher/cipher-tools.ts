/**
 * 暗号解読 - 暗号解読アルゴリズム
 */

import { SvelteSet } from 'svelte/reactivity';
import type { DecryptResult } from './types';
import { calculateGeneralConfidence } from './scoring';

// 暗号方式ごとの信頼度ボーナス
const CIPHER_BONUS: Record<string, number> = {
	Base64: 8,
	Reverse: 5,
	'Rail Fence': 5
};

/**
 * 暗号方式ごとのボーナスを適用
 */
function applyCipherBonus(result: DecryptResult): DecryptResult {
	const bonus = CIPHER_BONUS[result.cipher] ?? 0;
	if (bonus <= 0) return result;
	return {
		...result,
		confidence: result.confidence + bonus
	};
}

/**
 * Caesar cipher（全26パターン）
 */
export function decryptCaesar(text: string): DecryptResult[] {
	const results: DecryptResult[] = [];

	for (let shift = 1; shift < 26; shift++) {
		const decrypted = text.replace(/[a-zA-Z]/g, (char) => {
			const base = char <= 'Z' ? 65 : 97;
			return String.fromCharCode(((char.charCodeAt(0) - base - shift + 26) % 26) + base);
		});

		// 変化がある場合のみ追加
		if (decrypted !== text) {
			const confidence = calculateGeneralConfidence(decrypted);
			results.push(
				applyCipherBonus({
					cipher: 'Caesar cipher',
					result: decrypted,
					confidence,
					detail: `Shift: ${shift}`
				})
			);
		}
	}

	return results.sort((a, b) => b.confidence - a.confidence).slice(0, 5); // 上位5件
}

/**
 * ROT47（ASCII 33-126）
 */
export function decryptROT47(text: string): DecryptResult {
	const decrypted = text.replace(/[!-~]/g, (char) => {
		const code = char.charCodeAt(0);
		return String.fromCharCode(33 + ((code - 33 + 47) % 94));
	});

	return applyCipherBonus({
		cipher: 'ROT47',
		result: decrypted,
		confidence: calculateGeneralConfidence(decrypted)
	});
}

/**
 * Atbash cipher（A↔Z, B↔Y, ...）
 */
export function decryptAtbash(text: string): DecryptResult {
	const decrypted = text.replace(/[a-zA-Z]/g, (char) => {
		const base = char <= 'Z' ? 65 : 97;
		return String.fromCharCode(25 - (char.charCodeAt(0) - base) + base);
	});

	return applyCipherBonus({
		cipher: 'Atbash cipher',
		result: decrypted,
		confidence: calculateGeneralConfidence(decrypted)
	});
}

/**
 * XOR single-byte brute force
 */
export function decryptXOR(text: string): DecryptResult[] {
	const results: DecryptResult[] = [];
	const bytes = new TextEncoder().encode(text);
	const decoder = new TextDecoder('utf-8', { fatal: true });

	for (let key = 1; key < 256; key++) {
		try {
			const decrypted = bytes.map((b) => b ^ key);
			const decoded = decoder.decode(decrypted);

			// 印字可能文字のみかチェック
			if (/^[\x20-\x7E\n\r\t]*$/.test(decoded)) {
				const confidence = calculateGeneralConfidence(decoded);
				if (confidence > 20) {
					results.push(
						applyCipherBonus({
							cipher: 'XOR',
							result: decoded,
							confidence,
							detail: `Key: 0x${key.toString(16).padStart(2, '0').toUpperCase()} (${key})`
						})
					);
				}
			}
		} catch {
			// デコード失敗時はスキップ
		}
	}

	return results.sort((a, b) => b.confidence - a.confidence).slice(0, 10); // 上位10件
}

/**
 * Base64多段デコード
 */
export function decryptBase64Multi(text: string): DecryptResult[] {
	const results: DecryptResult[] = [];
	const seen = new SvelteSet<string>([text.trim()]);
	let current = text.trim();
	let depth = 0;

	while (depth < 10) {
		// Base64形式かチェック（パディングは最大2個まで）
		if (!/^[A-Za-z0-9+/]+={0,2}$/.test(current) || current.length % 4 !== 0) {
			break;
		}

		try {
			const binaryStr = atob(current);
			const bytes = Uint8Array.from(binaryStr, (c) => c.charCodeAt(0));
			const decoded = new TextDecoder('utf-8').decode(bytes);

			depth++;

			// 循環検出
			if (seen.has(decoded)) {
				break;
			}

			seen.add(decoded);
			const confidence = calculateGeneralConfidence(decoded);
			results.push(
				applyCipherBonus({
					cipher: 'Base64',
					result: decoded,
					confidence,
					detail: `${depth}回デコード`
				})
			);

			current = decoded.trim();
		} catch {
			break;
		}
	}

	return results;
}

/**
 * Reverse（逆順）
 */
export function decryptReverse(text: string): DecryptResult {
	const reversed = text.split('').reverse().join('');

	return applyCipherBonus({
		cipher: 'Reverse',
		result: reversed,
		confidence: calculateGeneralConfidence(reversed)
	});
}

/**
 * Rail Fence cipher（レール数2-5）
 */
export function decryptRailFence(text: string): DecryptResult[] {
	const results: DecryptResult[] = [];

	for (let rails = 2; rails <= 5; rails++) {
		try {
			const decrypted = railFenceDecrypt(text, rails);
			const confidence = calculateGeneralConfidence(decrypted);

			if (confidence > 20) {
				results.push(
					applyCipherBonus({
						cipher: 'Rail Fence',
						result: decrypted,
						confidence,
						detail: `Rails: ${rails}`
					})
				);
			}
		} catch {
			// デコード失敗時はスキップ
		}
	}

	return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Rail Fence復号化ヘルパー
 */
function railFenceDecrypt(ciphertext: string, rails: number): string {
	const len = ciphertext.length;
	const fence: (string | null)[][] = Array.from({ length: rails }, () => Array(len).fill(null));

	// まずジグザグパターンをマーク
	let rail = 0;
	let direction = 1;
	for (let i = 0; i < len; i++) {
		fence[rail][i] = '*'; // マーカー
		rail += direction;
		if (rail === 0 || rail === rails - 1) {
			direction *= -1;
		}
	}

	// 暗号文を各レールに配置
	let idx = 0;
	for (let r = 0; r < rails; r++) {
		for (let c = 0; c < len; c++) {
			if (fence[r][c] === '*') {
				fence[r][c] = ciphertext[idx++];
			}
		}
	}

	// ジグザグパターンで読み取り
	const result: string[] = [];
	rail = 0;
	direction = 1;
	for (let i = 0; i < len; i++) {
		const char = fence[rail][i];
		if (char === null) {
			throw new Error(`Unexpected null at rail ${rail}, position ${i}`);
		}
		result.push(char);
		rail += direction;
		if (rail === 0 || rail === rails - 1) {
			direction *= -1;
		}
	}

	return result.join('');
}
