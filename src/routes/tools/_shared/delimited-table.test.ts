import { describe, expect, it } from 'vitest';
import { detectDelimiter, parsePlainTable } from './delimited-table';

describe('表の区切り文字', () => {
	it('引用されていないタブを優先する', () => {
		expect(detectDelimiter('a,b,c\td')).toBe('tab');
	});

	it('引用内のタブを区切りとみなさない', () => {
		expect(detectDelimiter('a,"b\tc"')).toBe('comma');
	});

	it('先頭の行が1セルでも次の行でTSVを判別する', () => {
		expect(detectDelimiter('a\nb\tc')).toBe('tab');
		expect(detectDelimiter('\r\nb\tc')).toBe('tab');
	});
});

describe('CSV/TSVの読み取り', () => {
	it.each([
		['comma', ','],
		['tab', '\t']
	] as const)('BOM付きの%s区切りで先頭の引用セルを読み取る', (delimiter, separator) => {
		const input = '\uFEFF"a' + separator + 'b"' + separator + 'last';
		expect(detectDelimiter(input)).toBe(delimiter);
		expect(parsePlainTable(input)).toEqual([['a' + separator + 'b', 'last']]);
	});

	it('TSVをパースする', () => {
		expect(parsePlainTable('a\tb\nc\td')).toEqual([
			['a', 'b'],
			['c', 'd']
		]);
	});

	it('TSVの先頭と末尾の空セルを保持する', () => {
		expect(parsePlainTable('\ta\r\nb\t\r\n')).toEqual([
			['', 'a'],
			['b', '']
		]);
		expect(parsePlainTable('\t')).toEqual([['', '']]);
	});

	it('CSVの引用符内の改行、カンマ、引用符、空白を保持する', () => {
		expect(parsePlainTable('a,"b, ""c""\r\nd "\r\ne,f')).toEqual([
			['a', 'b, "c"\r\nd '],
			['e', 'f']
		]);
	});

	it('TSVの引用符内のタブと改行を1セルに保持する', () => {
		expect(parsePlainTable('a\t"b\tc\n""d"""')).toEqual([['a', 'b\tc\n"d"']]);
	});
});
