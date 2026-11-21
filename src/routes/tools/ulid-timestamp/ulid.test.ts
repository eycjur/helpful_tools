import { describe, it, expect } from 'vitest';
import { decodeUlid } from './ulid';

describe('decodeUlid', () => {
	it('ULID仕様の公式サンプルからタイムスタンプを正しく抽出する', () => {
		// https://github.com/ulid/spec に記載の例
		const result = decodeUlid('01ARZ3NDEKTSV4RRFFQ69G5FAV');
		expect(result.timestampMs).toBe(1469922850259);
		expect(result.date.toISOString()).toBe('2016-07-30T23:54:10.259Z');
	});

	it('小文字入力を大文字として正規化してデコードする', () => {
		const result = decodeUlid('01arz3ndektsv4rrffq69g5fav');
		expect(result.timestampMs).toBe(1469922850259);
	});

	it('前後の空白を無視する', () => {
		const result = decodeUlid('  01ARZ3NDEKTSV4RRFFQ69G5FAV  ');
		expect(result.timestampMs).toBe(1469922850259);
	});

	it('タイムスタンプが0のULID（Unix epoch）を正しくデコードする', () => {
		const result = decodeUlid('00000000000000000000000000');
		expect(result.timestampMs).toBe(0);
	});

	it('48ビットの上限を受け付け、上限を超えるタイムスタンプは拒否する', () => {
		expect(decodeUlid(`7${'Z'.repeat(25)}`).timestampMs).toBe(2 ** 48 - 1);
		expect(() => decodeUlid(`8${'0'.repeat(25)}`)).toThrow('範囲外');
	});

	it('大文字化するとCrockford Base32文字になるUnicode文字も拒否する', () => {
		expect(() => decodeUlid(`${'0'.repeat(25)}ſ`)).toThrow('不正な文字');
		expect(() => decodeUlid(`${'0'.repeat(24)}ß`)).toThrow('26文字');
	});

	it('26文字でない場合はエラーを投げる', () => {
		expect(() => decodeUlid('01ARZ3NDEKTSV4RRFFQ69G5FA')).toThrow('26文字');
		expect(() => decodeUlid('01ARZ3NDEKTSV4RRFFQ69G5FAVX')).toThrow('26文字');
	});

	it('Crockford Base32に含まれない文字（I, L, O, U）があるとエラーを投げる', () => {
		expect(() => decodeUlid('IIARZ3NDEKTSV4RRFFQ69G5FAV')).toThrow('不正な文字');
		expect(() => decodeUlid('01ARZ3NDEKTSV4RRFFQ69G5FAU')).toThrow('不正な文字');
	});

	it('記号など明らかに不正な文字があるとエラーを投げる', () => {
		expect(() => decodeUlid('01ARZ3NDEKTSV4RRFFQ69G5F!V')).toThrow('不正な文字');
	});
});
