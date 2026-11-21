/**
 * Markdown → Notion変換ロジック
 */

export function markdownToNotion(input: string): string {
	const lines = /([^\r\n]*)(?:\r\n?|\n|$)/g;
	let output = '';
	let start = 0;
	let line: RegExpExecArray | null;

	while ((line = lines.exec(input)) && line[0]) {
		const { quotes, indent, content } = getLineParts(line[1]);
		const list = content.match(/^(?:[-+*]|\d{1,9}[.)]) +/);
		const title = list ? content.slice(list[0].length) : content;
		const opening = title.match(/^(?:(`{3,})[^`]*|(~{3,})[^\r\n]*|(\$\$)[ \t]*)$/);
		if (!opening) continue;

		const marker = opening[1] ?? opening[2] ?? opening[3];
		const math = marker === '$$';
		const endMarker = math ? '\\$\\$' : marker[0] + '{' + marker.length + ',}';
		const closing = new RegExp('^' + endMarker + '[ \\t]*$');
		const minIndent = list ? indent + list[0].length : indent >= 4 ? indent : 0;
		const followingLines = new RegExp(lines);
		followingLines.lastIndex = lines.lastIndex;
		let blockEnd = line.index + line[1].length;
		let nextLine = input.length;
		let hasClosing = false;
		let candidate: RegExpExecArray | null;

		while ((candidate = followingLines.exec(input)) && candidate[0]) {
			const candidateParts = getLineParts(candidate[1]);
			if (
				candidateParts.quotes < quotes ||
				(candidateParts.quotes === quotes &&
					candidateParts.indent < minIndent &&
					candidateParts.content.trim())
			) {
				nextLine = candidate.index;
				break;
			}
			blockEnd = candidate.index + candidate[1].length;
			if (
				candidateParts.quotes === quotes &&
				candidateParts.indent >= minIndent &&
				candidateParts.indent <= minIndent + 3 &&
				closing.test(candidateParts.content)
			) {
				hasClosing = true;
				nextLine = followingLines.lastIndex;
				break;
			}
		}

		if (math && !hasClosing) continue;
		if (!hasClosing && nextLine === input.length) blockEnd = input.length;
		output += expandBreaks(input.slice(start, line.index)) + input.slice(line.index, blockEnd);
		start = blockEnd;
		lines.lastIndex = nextLine;
	}

	return output + expandBreaks(input.slice(start));
}

function getLineParts(line: string) {
	const [, quotePrefix, indentation, content] = /^((?: {0,3}> ?)*)( *)([^\r\n]*)$/.exec(line)!;
	return {
		quotes: quotePrefix.replace(/ /g, '').length,
		indent: indentation.length,
		content
	};
}

function expandBreaks(text: string): string {
	// 同じ本数のバッククォートで閉じられたインラインコードと、エスケープを保持する。
	return text.replace(/\\[\\`]|(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)|`+|\r\n?|\n/g, (match) =>
		match[0] === '\r' || match[0] === '\n' ? match.repeat(2) : match
	);
}
