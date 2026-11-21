/**
 * Markdown → Notion変換ロジック
 */

export function markdownToNotion(input: string): string {
	const lines = /([^\r\n]*)(?:\r\n?|\n|$)/g;
	let output = '';
	let start = 0;
	let afterBlank = true;
	let listQuotes = 0;
	const listIndents: number[] = [];
	let line: RegExpExecArray | null;

	while ((line = lines.exec(input)) && line[0]) {
		const { quotes, indent, content } = getLineParts(line[1]);
		const blank = !content;
		if (!blank) {
			if (quotes !== listQuotes) {
				listQuotes = quotes;
				listIndents.length = 0;
			}
			while (indent < (listIndents.at(-1) ?? 0)) listIndents.pop();
		}
		const baseIndent = listIndents.at(-1) ?? 0;
		const list = content.match(/^(?:[-+*]|\d{1,9}[.)])[ \t]+/);
		const title = list ? content.slice(list[0].length) : content;
		const opening = title.match(/^(?:(`{3,})[^`]*|(~{3,})[^\r\n]*|(\$\$)[ \t]*)$/);
		const indentedCode = !opening && indent >= baseIndent + 4 && afterBlank && !blank;
		const listIndent = list ? indentWidth(list[0], indent) : undefined;
		if (listIndent && !indentedCode) listIndents.push(listIndent);
		afterBlank = blank;
		if (!opening && !indentedCode) continue;

		const marker = opening?.[1] ?? opening?.[2] ?? opening?.[3];
		const math = marker === '$$';
		const endMarker = math ? '\\$\\$' : marker && marker[0] + '{' + marker.length + ',}';
		const closing = endMarker && new RegExp('^' + endMarker + '[ \\t]*$');
		const minIndent = indentedCode
			? baseIndent + 4
			: (listIndent ?? (baseIndent || (indent >= 4 ? indent : 0)));
		const followingLines = new RegExp(lines);
		followingLines.lastIndex = lines.lastIndex;
		let blockEnd = line.index + line[1].length;
		let nextLine = input.length;
		let hasClosing = false;
		let candidate: RegExpExecArray | null;

		while ((candidate = followingLines.exec(input)) && candidate[0]) {
			const candidateParts = getLineParts(candidate[1]);
			const candidateBlank = !candidateParts.content;
			if (
				candidateParts.quotes < quotes ||
				(candidateParts.quotes === quotes && candidateParts.indent < minIndent && !candidateBlank)
			) {
				nextLine = candidate.index;
				break;
			}
			if (!indentedCode || !candidateBlank) blockEnd = candidate.index + candidate[1].length;
			if (
				candidateParts.quotes === quotes &&
				candidateParts.indent >= minIndent &&
				candidateParts.indent <= minIndent + 3 &&
				closing &&
				closing.test(candidateParts.content)
			) {
				hasClosing = true;
				nextLine = followingLines.lastIndex;
				break;
			}
		}

		if (math && !hasClosing) continue;
		if (!indentedCode && !hasClosing && nextLine === input.length) blockEnd = input.length;
		output += expandBreaks(input.slice(start, line.index)) + input.slice(line.index, blockEnd);
		start = blockEnd;
		lines.lastIndex = nextLine;
		afterBlank = true;
	}

	return output + expandBreaks(input.slice(start));
}

function getLineParts(line: string) {
	const [, quotePrefix, indentation, content] = /^((?: {0,3}>[ \t]?)*)([ \t]*)([^\r\n]*)$/.exec(
		line
	)!;
	return {
		quotes: quotePrefix.replace(/[ \t]/g, '').length,
		indent: indentWidth(indentation),
		content
	};
}

function indentWidth(indentation: string, column = 0): number {
	for (const character of indentation) column += character === '\t' ? 4 - (column % 4) : 1;
	return column;
}

function expandBreaks(text: string): string {
	// インラインコードが空行を越えて別の段落にまたがらないようにする。
	return text
		.split(/((?:\r\n|\r(?!\n)|\n)[ \t]*(?:\r\n|\r(?!\n)|\n))/)
		.map((part) =>
			part.replace(/\\[\\`]|(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)|`+|\r\n?|\n/g, (match) =>
				match[0] === '\r' || match[0] === '\n' ? match.repeat(2) : match
			)
		)
		.join('');
}
