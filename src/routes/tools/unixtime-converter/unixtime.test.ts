import { describe, it, expect } from 'vitest';
import { unixtimeToDate, dateToUnixtime, formatInTimeZone } from './unixtime';

describe('unixtimeToDate', () => {
	it('秒単位のUnixtimeをDateに変換する', () => {
		const date = unixtimeToDate(0, 'seconds');
		expect(date.toISOString()).toBe('1970-01-01T00:00:00.000Z');
	});

	it('ミリ秒単位のUnixtimeをDateに変換する', () => {
		const date = unixtimeToDate(1609459200000, 'milliseconds');
		expect(date.toISOString()).toBe('2021-01-01T00:00:00.000Z');
	});

	it('秒単位の値を1000倍して正しく変換する', () => {
		const date = unixtimeToDate(1609459200, 'seconds');
		expect(date.toISOString()).toBe('2021-01-01T00:00:00.000Z');
	});

	it('負のUnixtime（1970年より前）も変換できる', () => {
		const date = unixtimeToDate(-86400, 'seconds');
		expect(date.toISOString()).toBe('1969-12-31T00:00:00.000Z');
	});

	it('NaNや非数値はエラーを投げる', () => {
		expect(() => unixtimeToDate(NaN, 'seconds')).toThrow('数値で入力');
		expect(() => unixtimeToDate(Infinity, 'seconds')).toThrow('数値で入力');
	});
});

describe('dateToUnixtime', () => {
	it('Dateを秒単位のUnixtimeに変換する', () => {
		const date = new Date('2021-01-01T00:00:00.000Z');
		expect(dateToUnixtime(date, 'seconds')).toBe(1609459200);
	});

	it('Dateをミリ秒単位のUnixtimeに変換する', () => {
		const date = new Date('2021-01-01T00:00:00.123Z');
		expect(dateToUnixtime(date, 'milliseconds')).toBe(1609459200123);
	});

	it('秒単位変換時にミリ秒以下は切り捨てる', () => {
		const date = new Date('2021-01-01T00:00:00.999Z');
		expect(dateToUnixtime(date, 'seconds')).toBe(1609459200);
	});
});

describe('formatInTimeZone', () => {
	it('UTCタイムゾーンでフォーマットする', () => {
		const date = new Date('2021-01-01T00:00:00.000Z');
		const formatted = formatInTimeZone(date, 'UTC');
		expect(formatted).toContain('2021');
		expect(formatted).toContain('01/01');
	});

	it('Asia/Tokyoタイムゾーンでは9時間進んだ時刻になる', () => {
		const date = new Date('2021-01-01T00:00:00.000Z');
		const formatted = formatInTimeZone(date, 'Asia/Tokyo');
		expect(formatted).toContain('09:00:00');
	});
});
