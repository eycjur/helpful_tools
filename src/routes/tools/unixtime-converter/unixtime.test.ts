import { describe, it, expect } from 'vitest';
import { unixtimeToDate, dateToUnixtime, formatInTimeZone, parseLocalDatetime } from './unixtime';

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

	it('秒の小数が正確なミリ秒を表すときは丸め誤差で1ms欠けない', () => {
		expect(unixtimeToDate(1.001, 'seconds').getTime()).toBe(1001);
		expect(unixtimeToDate(-1.001, 'seconds').getTime()).toBe(-1001);
		expect(unixtimeToDate(1.0009999, 'seconds').getTime()).toBe(1000);
	});

	it('Dateの上下限を受け付け、1ms外側を拒否する', () => {
		const limit = 8_640_000_000_000_000;
		expect(unixtimeToDate(limit, 'milliseconds').getTime()).toBe(limit);
		expect(unixtimeToDate(-limit, 'milliseconds').getTime()).toBe(-limit);
		expect(() => unixtimeToDate(limit + 1, 'milliseconds')).toThrow('日時に変換できない');
		expect(() => unixtimeToDate(-limit - 1, 'milliseconds')).toThrow('日時に変換できない');
	});
});

describe('parseLocalDatetime', () => {
	it('符号なしの拡張年をミリ秒まで変換する', () => {
		const result = parseLocalDatetime('10000-01-01T00:00:00.123');
		expect(result.getFullYear()).toBe(10000);
		expect(result.getMilliseconds()).toBe(123);
	});

	it('ローカルカレンダーに存在しない日時を繰り上げない', () => {
		expect(() => parseLocalDatetime('2024-02-30T12:30')).toThrow('存在しません');
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

	it('入力値のミリ秒をタイムゾーン変換後の表示にも保持する', () => {
		const date = unixtimeToDate(1609459200123, 'milliseconds');
		expect(formatInTimeZone(date, 'Asia/Tokyo')).toContain('09:00:00.123');
	});

	it('紀元前の日時を西暦の同じ年数と区別する', () => {
		const date = new Date('0000-12-31T20:00:00.000Z');
		expect(formatInTimeZone(date, 'UTC')).toContain('紀元前');
		expect(formatInTimeZone(date, 'Asia/Tokyo')).toContain('西暦');
	});
});
