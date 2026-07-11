export interface DecodedJwt {
	header: unknown;
	payload: unknown;
	signature: string;
}

const MAX_INPUT_LENGTH = 100_000;

/**
 * Base64URL文字列をUTF-8文字列としてデコードする。
 */
function base64UrlDecode(input: string): string {
	let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
	const paddingLength = base64.length % 4;
	if (paddingLength === 2) {
		base64 += '==';
	} else if (paddingLength === 3) {
		base64 += '=';
	} else if (paddingLength !== 0) {
		throw new Error('Base64URLの長さが不正です');
	}

	let binary: string;
	try {
		binary = atob(base64);
	} catch {
		throw new Error('Base64URLのデコードに失敗しました');
	}

	const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
	return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/**
 * JWT（ヘッダー.ペイロード.署名）をデコードする。署名の検証は行わない。
 */
export function decodeJwt(token: string): DecodedJwt {
	const trimmed = token.trim();
	if (trimmed.length > MAX_INPUT_LENGTH) {
		throw new Error(`入力が長すぎます（上限: ${MAX_INPUT_LENGTH.toLocaleString()}文字）`);
	}

	const parts = trimmed.split('.');
	if (parts.length !== 3) {
		throw new Error('JWTの形式が不正です（ヘッダー.ペイロード.署名の3部構成である必要があります）');
	}
	const [headerPart, payloadPart, signaturePart] = parts;

	let header: unknown;
	try {
		header = JSON.parse(base64UrlDecode(headerPart));
	} catch {
		throw new Error('ヘッダーのデコードに失敗しました');
	}

	let payload: unknown;
	try {
		payload = JSON.parse(base64UrlDecode(payloadPart));
	} catch {
		throw new Error('ペイロードのデコードに失敗しました');
	}

	return { header, payload, signature: signaturePart };
}

// JWT標準クレームのうち、Unixtime（秒）で表現される日時フィールド
export const JWT_TIME_CLAIMS = new Set(['exp', 'iat', 'nbf']);

export function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
