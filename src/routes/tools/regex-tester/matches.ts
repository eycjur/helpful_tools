export function findMatches(pattern: RegExp, input: string) {
	function describeMatch(match: RegExpExecArray) {
		const [text, ...captures] = match;
		return {
			index: match.index,
			length: pattern.unicode ? Array.from(text).length : text.length,
			text,
			captures,
			groups: match.groups
		};
	}

	if (pattern.global) return Array.from(input.matchAll(pattern), describeMatch);

	const match = pattern.exec(input);
	return match ? [describeMatch(match)] : [];
}
