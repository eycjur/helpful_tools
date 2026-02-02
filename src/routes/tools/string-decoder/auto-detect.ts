/**
 * エンコード文字列デコーダ - 自動検出機能
 */

import type { DecodeResult } from './types';
import {
	decodeURL,
	decodeHTMLEntity,
	decodeBase64,
	decodeUnicodeJS,
	decodeUnicodeCodePoint,
	decodeUnicodeCSS,
	decodeHexJS,
	decodeOctalJS,
	decodeJSONString,
	decodePunycode,
	decodeROT13,
	decodeBinary,
	decodeDecimal,
	decodeHexNum,
	decodeMorse,
	decodeQuotedPrintable
} from './decoders';

/**
 * 入力テキストから可能性のあるエンコード形式を自動検出してデコード
 * @param text - エンコードされた文字列
 * @returns デコード結果の配列（信頼度順にソート）
 */
export function autoDetect(text: string): DecodeResult[] {
	const results: DecodeResult[] = [];

	// URLエンコード検出
	if (/%[0-9A-Fa-f]{2}/.test(text)) {
		try {
			const decoded = decodeURL(text);
			if (decoded !== text) {
				results.push({
					format: 'URLエンコード',
					result: decoded,
					confidence: 95
				});
			}
		} catch {
			// デコード失敗時はスキップ
		}
	}

	// HTMLエンティティ検出
	if (/&(#\d+|#x[0-9a-fA-F]+|[a-z]+);/.test(text)) {
		try {
			const decoded = decodeHTMLEntity(text);
			if (decoded !== text) {
				results.push({
					format: 'HTMLエンティティ',
					result: decoded,
					confidence: 95
				});
			}
		} catch {
			// デコード失敗時はスキップ
		}
	}

	// Base64検出
	if (/^[A-Za-z0-9+/]+=*$/.test(text.trim()) && text.length % 4 === 0) {
		try {
			const decoded = decodeBase64(text);
			results.push({
				format: 'Base64',
				result: decoded,
				confidence: 90
			});
		} catch {
			// デコード失敗時はスキップ
		}
	}

	// Unicode エスケープ検出 (\uHHHH)
	if (/\\u[0-9a-fA-F]{4}/.test(text)) {
		try {
			const decoded = decodeUnicodeJS(text);
			if (decoded !== text) {
				results.push({
					format: 'Unicode (\\uHHHH)',
					result: decoded,
					confidence: 95
				});
			}
		} catch {
			// デコード失敗時はスキップ
		}
	}

	// Unicode コードポイント検出 (\u{...})
	if (/\\u\{[0-9a-fA-F]+\}/.test(text)) {
		try {
			const decoded = decodeUnicodeCodePoint(text);
			if (decoded !== text) {
				results.push({
					format: 'Unicode (\\u{...})',
					result: decoded,
					confidence: 95
				});
			}
		} catch {
			// デコード失敗時はスキップ
		}
	}

	// CSS Unicode検出
	if (/\\[0-9a-fA-F]{1,6}(?:\s|$)/.test(text)) {
		try {
			const decoded = decodeUnicodeCSS(text);
			if (decoded !== text) {
				results.push({
					format: 'CSS Unicode',
					result: decoded,
					confidence: 85
				});
			}
		} catch {
			// デコード失敗時はスキップ
		}
	}

	// 16進数エスケープ検出 (\xHH)
	if (/\\x[0-9a-fA-F]{2}/.test(text)) {
		try {
			const decoded = decodeHexJS(text);
			if (decoded !== text) {
				results.push({
					format: '16進数 (\\xHH)',
					result: decoded,
					confidence: 90
				});
			}
		} catch {
			// デコード失敗時はスキップ
		}
	}

	// 8進数エスケープ検出 (\NNN)
	if (/\\[0-7]{1,3}/.test(text)) {
		try {
			const decoded = decodeOctalJS(text);
			if (decoded !== text) {
				results.push({
					format: '8進数 (\\NNN)',
					result: decoded,
					confidence: 80
				});
			}
		} catch {
			// デコード失敗時はスキップ
		}
	}

	// JSON文字列検出
	if (/^".*"$/.test(text.trim())) {
		try {
			const decoded = decodeJSONString(text.trim());
			results.push({
				format: 'JSON文字列',
				result: decoded,
				confidence: 90
			});
		} catch {
			// デコード失敗時はスキップ
		}
	}

	// Punycode検出
	if (/^xn--[a-z0-9]+$/i.test(text.trim())) {
		try {
			const decoded = decodePunycode(text.trim());
			if (decoded !== text.trim()) {
				results.push({
					format: 'Punycode',
					result: decoded,
					confidence: 95
				});
			}
		} catch {
			// デコード失敗時はスキップ
		}
	}

	// ROT13検出（アルファベットのみの場合）
	if (/^[a-zA-Z\s]+$/.test(text)) {
		try {
			const decoded = decodeROT13(text);
			results.push({
				format: 'ROT13',
				result: decoded,
				confidence: 50
			});
		} catch {
			// デコード失敗時はスキップ
		}
	}

	// 2進数検出
	if (/^[01\s]+$/.test(text.trim()) && /[01]{8}/.test(text)) {
		try {
			const decoded = decodeBinary(text.replace(/\s/g, ''));
			results.push({
				format: '2進数',
				result: decoded,
				confidence: 85
			});
		} catch {
			// デコード失敗時はスキップ
		}
	}

	// 10進数検出（スペース区切り）
	if (/^\d+(\s+\d+)+$/.test(text.trim())) {
		try {
			const decoded = decodeDecimal(text);
			const nums = text
				.trim()
				.split(/\s+/)
				.map((n) => parseInt(n, 10));
			// ASCII範囲内かチェック
			if (nums.every((n) => n >= 32 && n <= 126)) {
				results.push({
					format: '10進数',
					result: decoded,
					confidence: 75
				});
			}
		} catch {
			// デコード失敗時はスキップ
		}
	}

	// 16進数検出（スペース区切り）
	if (/^[0-9a-fA-F]+(\s+[0-9a-fA-F]+)+$/.test(text.trim())) {
		try {
			const decoded = decodeHexNum(text);
			results.push({
				format: '16進数',
				result: decoded,
				confidence: 80
			});
		} catch {
			// デコード失敗時はスキップ
		}
	}

	// モールス信号検出
	if (/^[.\-\s]+$/.test(text)) {
		try {
			const decoded = decodeMorse(text);
			results.push({
				format: 'Morse Code',
				result: decoded,
				confidence: 70
			});
		} catch {
			// デコード失敗時はスキップ
		}
	}

	// Quoted-Printable検出
	if (/=[A-F0-9]{2}/.test(text)) {
		try {
			const decoded = decodeQuotedPrintable(text);
			if (decoded !== text) {
				results.push({
					format: 'Quoted-Printable',
					result: decoded,
					confidence: 85
				});
			}
		} catch {
			// デコード失敗時はスキップ
		}
	}

	// 信頼度順にソート
	return results.sort((a, b) => b.confidence - a.confidence);
}
