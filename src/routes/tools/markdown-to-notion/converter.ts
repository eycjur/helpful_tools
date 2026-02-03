/**
 * Markdown → Notion変換ロジック
 */

export function markdownToNotion(input: string): string {
	let output: string = input;

	let placeholderPrefix = '__CODE_BLOCK__';
	while (output.includes(placeholderPrefix)) {
		placeholderPrefix += '_X';
	}

	// コードブロック内の改行は保持し、それ以外の改行を2つの改行に置換
	const codeBlockRegex = /```[\s\S]*?```|`[^`]*`/g;
	const codeBlocks: string[] = [];

	// コードブロックを一時的に保存
	output = output.replace(codeBlockRegex, (match) => {
		codeBlocks.push(match);
		return `${placeholderPrefix}${codeBlocks.length - 1}__`;
	});

	// コードブロック以外の改行を2つの改行に置換
	output = output.replace(/\n/g, '\n\n');

	// コードブロックを復元
	codeBlocks.forEach((codeBlock, index) => {
		output = output.replace(`${placeholderPrefix}${index}__`, codeBlock);
	});

	return output;
}
