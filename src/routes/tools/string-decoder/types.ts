/**
 * エンコード文字列デコーダ - 型定義
 */

export type EncodingFormat =
	| 'auto'
	| 'url'
	| 'html-entity'
	| 'base64'
	| 'unicode-js'
	| 'unicode-css'
	| 'unicode-codepoint'
	| 'hex-js'
	| 'octal-js'
	| 'json-string'
	| 'punycode'
	| 'base58'
	| 'rot13'
	| 'binary'
	| 'octal-num'
	| 'decimal'
	| 'hex-num'
	| 'morse'
	| 'quoted-printable'
	| 'uuencode';

export interface DecodeResult {
	format: string;
	result: string;
	confidence: number; // 0-100
}

export interface FormatInfo {
	label: string;
	description: string;
	example: string;
}
