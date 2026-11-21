import { describe, it, expect } from 'vitest';
import { decodeJwt, isPlainObject } from './jwt';

// jwt.io のデフォルトサンプル（HS256）
const SAMPLE_JWT =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

describe('decodeJwt', () => {
	it('ヘッダーとペイロードを正しくデコードする', () => {
		const result = decodeJwt(SAMPLE_JWT);
		expect(result.header).toEqual({ alg: 'HS256', typ: 'JWT' });
		expect(result.payload).toEqual({
			sub: '1234567890',
			name: 'John Doe',
			iat: 1516239022
		});
	});

	it('署名部分はデコードせずそのまま返す', () => {
		const result = decodeJwt(SAMPLE_JWT);
		expect(result.signature).toBe('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
	});

	it('前後の空白を無視する', () => {
		const result = decodeJwt(`  ${SAMPLE_JWT}  `);
		expect(result.header).toEqual({ alg: 'HS256', typ: 'JWT' });
	});

	it('3部構成でない場合はエラーを投げる', () => {
		expect(() => decodeJwt('a.b')).toThrow('3部構成');
		expect(() => decodeJwt('a.b.c.d')).toThrow('3部構成');
		expect(() => decodeJwt('not-a-jwt')).toThrow('3部構成');
	});

	it('入力が長すぎる場合はエラーを投げる', () => {
		const tooLong = 'a'.repeat(100_001);
		expect(() => decodeJwt(tooLong)).toThrow('長すぎます');
	});

	it('ヘッダー部分が不正なBase64の場合はエラーを投げる', () => {
		expect(() => decodeJwt('!!!invalid!!!.eyJhIjoxfQ.sig')).toThrow('ヘッダー');
	});

	it('ペイロードがJSONとして不正な場合はエラーを投げる', () => {
		// "not json" をBase64URLエンコードした値
		const invalidPayload = btoa('not json').replace(/\+/g, '-').replace(/\//g, '_');
		expect(() => decodeJwt(`eyJhbGciOiJIUzI1NiJ9.${invalidPayload}.sig`)).toThrow('ペイロード');
	});

	it('HeaderとPayloadにはJSONオブジェクトが必要', () => {
		expect(() => decodeJwt('bnVsbA.e30.')).toThrow('ヘッダー');
		expect(() => decodeJwt('e30.W10.')).toThrow('ペイロード');
	});

	it('Base64URL部分の空白やパディングは拒否する', () => {
		expect(() => decodeJwt('e30\n.e30.')).toThrow('ヘッダー');
		expect(() => decodeJwt('e30.e30=.')).toThrow('ペイロード');
	});

	it('入力上限ちょうどのJWTをデコードできる', () => {
		const atLimit = `e30.e30.${'a'.repeat(99_992)}`;
		expect(atLimit).toHaveLength(100_000);
		expect(decodeJwt(atLimit).header).toEqual({});
	});

	it('日本語を含むペイロードを正しくデコードする（UTF-8対応）', () => {
		const payload = { name: '田中太郎' };
		const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '');
		const result = decodeJwt(`eyJhbGciOiJIUzI1NiJ9.${encoded}.sig`);
		expect(result.payload).toEqual(payload);
	});
});

describe('isPlainObject', () => {
	it('プレーンオブジェクトに対してtrueを返す', () => {
		expect(isPlainObject({ a: 1 })).toBe(true);
	});

	it('配列に対してfalseを返す', () => {
		expect(isPlainObject([1, 2, 3])).toBe(false);
	});

	it('nullに対してfalseを返す', () => {
		expect(isPlainObject(null)).toBe(false);
	});

	it('プリミティブ値に対してfalseを返す', () => {
		expect(isPlainObject('string')).toBe(false);
		expect(isPlainObject(123)).toBe(false);
	});
});
