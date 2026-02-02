/**
 * 文字数カウンタ - カウントロジック
 */

/**
 * グラフェム数（見た目の文字数）をカウント
 * Intl.Segmenterを使用して絵文字等も正しくカウント
 */
export function countGraphemes(str: string): number {
	if (!str) return 0;
	const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });
	return [...segmenter.segment(str)].length;
}

/**
 * バイト数をカウント（UTF-8）
 */
export function countBytes(str: string): number {
	return new TextEncoder().encode(str).length;
}

/**
 * 行数をカウント
 */
export function countLines(str: string): number {
	if (!str) return 0;
	return str.split('\n').length;
}
