export type TableDelimiter = 'tab' | 'comma';

export interface ParseResult {
	rows: string[][];
	delimiter: TableDelimiter;
}

/**
 * 区切り文字を推定（タブ優先、Excel/スプレッドシートの貼り付け想定）
 */
export function detectDelimiter(text: string): TableDelimiter {
	const firstLine = text.trim().split(/\r?\n/)[0] ?? '';
	const tabCount = (firstLine.match(/\t/g) || []).length;
	const commaCount = (firstLine.match(/,/g) || []).length;
	if (tabCount > 0 && tabCount >= commaCount) return 'tab';
	return 'comma';
}

/**
 * CSV 1行をパース（ダブルクォート対応）
 */
function parseCsvLine(line: string): string[] {
	const row: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		if (char === '"') {
			if (inQuotes && line[i + 1] === '"') {
				current += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
			}
		} else if (char === ',' && !inQuotes) {
			row.push(current);
			current = '';
		} else {
			current += char;
		}
	}
	row.push(current);
	return row.map((cell) => cell.trim());
}

/**
 * プレーンテキスト（TSV/CSV）を表にパース
 */
export function parsePlainTable(text: string, delimiter?: TableDelimiter): string[][] {
	const trimmed = text.trim();
	if (!trimmed) return [];

	const sep = delimiter ?? detectDelimiter(trimmed);
	const lines = trimmed.split(/\r?\n/);

	return lines.map((line) => {
		if (sep === 'tab') {
			return line.split('\t').map((cell) => cell.trim());
		}
		return parseCsvLine(line);
	});
}

/**
 * HTML 表をパース（クリップボードの text/html 用）
 */
export function parseHtmlTable(html: string): string[][] | null {
	const doc = new DOMParser().parseFromString(html, 'text/html');
	const table = doc.querySelector('table');
	if (!table) return null;

	const rows: string[][] = [];
	for (const tr of table.querySelectorAll('tr')) {
		const cells = [...tr.querySelectorAll('th, td')].map(
			(cell) => cell.textContent?.replace(/\u00a0/g, ' ').trim() ?? ''
		);
		if (cells.length > 0) rows.push(cells);
	}
	return rows.length > 0 ? rows : null;
}

/**
 * 行と列を入れ替え（不足セルは空文字で埋める）
 */
export function transposeTable(rows: string[][]): string[][] {
	if (rows.length === 0) return [];

	const maxCols = Math.max(...rows.map((r) => r.length), 0);
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
	return rows.map((row) => row.join('\t')).join('\n');
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

	const rows = parsePlainTable(plain);
	if (rows.length === 0) return null;

	return { rows, delimiter: detectDelimiter(plain) };
}

/**
 * 転置して TSV 出力
 */
export function transposeToTsv(input: string, html?: string): string | null {
	const parsed = parseTableFromClipboard(input, html);
	if (!parsed || parsed.rows.length === 0) return null;
	return tableToTsv(transposeTable(parsed.rows));
}
