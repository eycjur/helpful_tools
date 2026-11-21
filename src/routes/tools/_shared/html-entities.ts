export function decodeHtmlEntities(text: string): string {
	const textarea = document.createElement('textarea');
	// 入力中のタグや改行を文字として保ったまま、文字参照を一度だけ解釈する。
	textarea.innerHTML = text.replaceAll('<', '&lt;').replaceAll('\r', '&#13;');
	return textarea.textContent ?? '';
}
