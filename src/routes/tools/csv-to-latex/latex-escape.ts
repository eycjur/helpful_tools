/**
 * LaTeX特殊文字をエスケープする
 *
 * バックスラッシュを一時的なプレースホルダー（Private Use Area）に置換することで、
 * 二重エスケープを防ぐ
 */
export function escapeLatex(text: string): string {
	// バックスラッシュを一時的なプレースホルダーに置換
	// Private Use Area（U+E000）を使用して衝突を回避
	const BACKSLASH_PLACEHOLDER = '\uE000';

	return (
		text
			.replace(/\\/g, BACKSLASH_PLACEHOLDER)
			.replace(/\$/g, '\\$')
			.replace(/&/g, '\\&')
			.replace(/%/g, '\\%')
			.replace(/#/g, '\\#')
			.replace(/\^/g, '\\textasciicircum{}')
			.replace(/_/g, '\\_')
			.replace(/\{/g, '\\{')
			.replace(/\}/g, '\\}')
			.replace(/~/g, '\\textasciitilde{}')
			// 最後にプレースホルダーを\textbackslash{}に変換
			.replace(new RegExp(BACKSLASH_PLACEHOLDER, 'g'), '\\textbackslash{}')
	);
}
