import { describe, it, expect } from 'vitest';
import { transposeTable, transposeToTsv, parseHtmlTable } from './table-transpose';

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

	it('先頭・末尾の空セルを保持する', () => {
		expect(transposeToTsv('\ta\nb\t')).toBe('\tb\na\t');
		expect(transposeToTsv('a\nb\tc')).toBe('a\tb\n\tc');
	});

	it('引用されたセル内の改行・タブ・引用符を保持する', () => {
		expect(transposeToTsv('a,"b\n""c"""\nd,"e\tf"')).toBe('a\td\n"b\n""c"""\t"e\tf"');
	});

	it('1列の空セルやカンマを持つセルを再び転置できる', () => {
		expect(transposeToTsv('\t')).toBe('""\n""');
		expect(transposeToTsv('""\n""')).toBe('\t');
		expect(transposeToTsv('"a,b"\tc')).toBe('"a,b"\nc');
		expect(transposeToTsv('"a,b"\nc')).toBe('a,b\tc');
	});

	it('空白だけを持つセルを再び転置できる', () => {
		expect(transposeToTsv('" "\t"  "')).toBe('" "\n"  "');
		expect(transposeToTsv('" "\n"  "')).toBe(' \t  ');
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

	it('BRをセル内改行として保持し、内側の表の行を列に加えない', () => {
		const html =
			'<table><tr><td>a<br>b</td><td><table><tr><td>x</td></tr></table></td></tr></table>';
		expect(parseHtmlTable(html)).toEqual([['a\nb', 'x']]);
	});
});
