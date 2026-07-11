export type UnixtimeUnit = 'seconds' | 'milliseconds';

export interface TimezoneOption {
	label: string;
	timeZone: string;
}

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
	{ label: 'UTC', timeZone: 'UTC' },
	{ label: 'JST（東京）', timeZone: 'Asia/Tokyo' },
	{ label: 'PT（ロサンゼルス）', timeZone: 'America/Los_Angeles' },
	{ label: 'ET（ニューヨーク）', timeZone: 'America/New_York' },
	{ label: 'GMT/BST（ロンドン）', timeZone: 'Europe/London' }
];

/**
 * Unixtime（秒 or ミリ秒）をDateに変換する。範囲外・NaNの場合はエラーを投げる。
 */
export function unixtimeToDate(value: number, unit: UnixtimeUnit): Date {
	if (!Number.isFinite(value)) {
		throw new Error('Unixtimeは数値で入力してください');
	}
	const ms = unit === 'seconds' ? value * 1000 : value;
	const date = new Date(ms);
	if (Number.isNaN(date.getTime())) {
		throw new Error('日時に変換できない値です');
	}
	return date;
}

/**
 * DateをUnixtimeに変換する。
 */
export function dateToUnixtime(date: Date, unit: UnixtimeUnit): number {
	const ms = date.getTime();
	return unit === 'seconds' ? Math.floor(ms / 1000) : ms;
}

export function formatInTimeZone(date: Date, timeZone: string): string {
	return new Intl.DateTimeFormat('ja-JP', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
		timeZoneName: 'short'
	}).format(date);
}
