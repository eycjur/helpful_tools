/**
 * Markdown → Notion変換ロジック
 */

export function markdownToNotion(input: string): string {
	// コードブロック内の改行は保持し、それ以外の改行を2つの改行に置換
	return input.replace(/```[\s\S]*?```|`[^`]*`|\r\n?|\n/g, (match) =>
		match.startsWith('`') ? match : match.repeat(2)
	);
}
