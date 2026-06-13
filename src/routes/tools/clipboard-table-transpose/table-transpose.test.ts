import { describe, it, expect } from 'vitest';
import {
	detectDelimiter,
	parsePlainTable,
	transposeTable,
	transposeToTsv,
	parseHtmlTable
} from './table-transpose';

describe('detectDelimiter', () => {
	it('タブが多い場合は tab', () => {
		expect(detectDelimiter('a\tb\tc')).toBe('tab');
	});

	it('カンマのみの場合は comma', () => {
		expect(detectDelimiter('a,b,c')).toBe('comma');
	});
});

describe('parsePlainTable', () => {
	it('TSV をパースする', () => {
		expect(parsePlainTable('a\tb\nc\td')).toEqual([
			['a', 'b'],
			['c', 'd']
		]);
	});
});

describe('transposeTable', () => {
	it('2x3 を 3x2 に転置する', () => {
		const input = [
			['1', '2', '3'],
			['4', '5', '6']
		];
		expect(transposeTable(input)).toEqual([
			['1', '4'],
			['2', '5'],
			['3', '6']
		]);
	});

	it('行の長さが揃っていない表を正規化して転置する', () => {
		const input = [
			['a', 'b', 'c'],
			['d', 'e']
		];
		expect(transposeTable(input)).toEqual([
			['a', 'd'],
			['b', 'e'],
			['c', '']
		]);
	});

	it('空配列は空を返す', () => {
		expect(transposeTable([])).toEqual([]);
	});
});

describe('tableToTsv / transposeToTsv', () => {
	it('転置結果を TSV にする', () => {
		expect(transposeToTsv('a\tb\nc\td')).toBe('a\tc\nb\td');
	});

	it('空入力は null', () => {
		expect(transposeToTsv('')).toBeNull();
	});
});

describe('parseHtmlTable', () => {
	it('HTML 表をパースする', () => {
		const html = '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>';
		expect(parseHtmlTable(html)).toEqual([
			['A', 'B'],
			['1', '2']
		]);
	});

	it('table が無い場合は null', () => {
		expect(parseHtmlTable('<p>no table</p>')).toBeNull();
	});
});
