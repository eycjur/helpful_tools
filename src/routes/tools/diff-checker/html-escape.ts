/**
 * HTML特殊文字をエスケープする（XSS対策）
 *
 * {@html}でHTMLを挿入する際のXSS攻撃を防ぐため、
 * すべての特殊文字をHTMLエンティティに変換する
 */
export function escapeHtml(text: string): string {
	return text.replace(/[&<>"']/g, (match) => {
		return (
			{
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&#x27;'
			}[match] || match
		);
	});
}
