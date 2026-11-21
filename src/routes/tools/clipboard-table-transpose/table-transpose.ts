import { detectDelimiter, parsePlainTable, type TableDelimiter } from '../_shared/delimited-table';

export interface ParseResult {
	rows: string[][];
	delimiter: TableDelimiter;
}

/**
 * HTML 表をパース（クリップボードの text/html 用）
 */
export function parseHtmlTable(html: string): string[][] | null {
	const doc = new DOMParser().parseFromString(html, 'text/html');
	const table = doc.querySelector('table');
	if (!table) return null;

	const rows: string[][] = [];
	for (const tr of table.rows) {
		const cells = [...tr.cells].map((cell) => {
			for (const br of cell.querySelectorAll('br')) br.replaceWith('\n');
			return cell.textContent?.replace(/\u00a0/g, ' ').trim() ?? '';
		});
		if (cells.length > 0) rows.push(cells);
	}
	return rows.length > 0 ? rows : null;
}

/**
 * 行と列を入れ替え（不足セルは空文字で埋める）
 */
export function transposeTable(rows: string[][]): string[][] {
	if (rows.length === 0) return [];

	const maxCols = rows.reduce((max, row) => Math.max(max, row.length), 0);
	if (maxCols === 0) return [];

	const normalized = rows.map((row) => {
		const copy = [...row];
		while (copy.length < maxCols) copy.push('');
		return copy;
	});

	const transposed: string[][] = [];
	for (let c = 0; c < maxCols; c++) {
		transposed.push(normalized.map((row) => row[c] ?? ''));
	}
	return transposed;
}

/**
 * 表を TSV 文字列に（Excel 等への貼り付け用）
 */
export function tableToTsv(rows: string[][]): string {
	return rows
		.map((row) =>
			row
				.map((cell) => {
					const needsQuotes =
						/["\t\r\n]/.test(cell) || (row.length === 1 && (!cell.trim() || cell.includes(',')));
					return needsQuotes ? `"${cell.replaceAll('"', '""')}"` : cell;
				})
				.join('\t')
		)
		.join('\n');
}

/**
 * プレーンテキストまたは HTML から表を取得
 */
export function parseTableFromClipboard(plain: string, html?: string): ParseResult | null {
	if (html?.trim()) {
		const fromHtml = parseHtmlTable(html);
		if (fromHtml && fromHtml.length > 0) {
			return { rows: fromHtml, delimiter: 'tab' };
		}
	}

	const delimiter = detectDelimiter(plain);
	const rows = parsePlainTable(plain, delimiter);
	if (rows.length === 0) return null;

	return { rows, delimiter };
}

/**
 * 転置して TSV 出力
 */
export function transposeToTsv(input: string, html?: string): string | null {
	const parsed = parseTableFromClipboard(input, html);
	if (!parsed || parsed.rows.length === 0) return null;
	return tableToTsv(transposeTable(parsed.rows));
}
