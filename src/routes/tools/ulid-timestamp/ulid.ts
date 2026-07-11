// Crockford's Base32（ULID仕様: I, L, O, Uを除いた32文字）
const CROCKFORD_BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export interface DecodedUlid {
	timestampMs: number;
	date: Date;
}

/**
 * ULID文字列から埋め込まれたタイムスタンプ（先頭10文字, 48bit, ミリ秒精度）を抽出する。
 * 参考: https://github.com/ulid/spec
 */
export function decodeUlid(input: string): DecodedUlid {
	const normalized = input.trim().toUpperCase();

	if (normalized.length !== 26) {
		throw new Error(`ULIDは26文字である必要があります（入力: ${normalized.length}文字）`);
	}

	for (const char of normalized) {
		if (!CROCKFORD_BASE32.includes(char)) {
			throw new Error(`不正な文字が含まれています: "${char}"`);
		}
	}

	const timePart = normalized.slice(0, 10);
	let timestampMs = 0;
	for (const char of timePart) {
		timestampMs = timestampMs * 32 + CROCKFORD_BASE32.indexOf(char);
	}

	// 48bit最大値（2^48 - 1）を超える場合は仕様外
	if (timestampMs > 281474976710655) {
		throw new Error('タイムスタンプが範囲外です（48bitの上限を超えています）');
	}

	return { timestampMs, date: new Date(timestampMs) };
}
