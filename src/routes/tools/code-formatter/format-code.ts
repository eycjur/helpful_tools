interface FormatOptions {
	removeEmptyLineSpaces: boolean;
	removeTrailingSpaces: boolean;
	convertTabsToSpaces: boolean;
	tabSize: number | undefined;
}

export function formatCode(input: string, options: FormatOptions) {
	const stats = {
		emptyLinesWithSpaces: 0,
		trailingSpacesRemoved: 0,
		tabsConverted: 0,
		totalSpacesRemoved: 0,
		linesProcessed: 0
	};
	if (!input) return { output: '', stats };

	const { removeEmptyLineSpaces, removeTrailingSpaces, convertTabsToSpaces, tabSize } = options;
	const tabReplacement =
		convertTabsToSpaces &&
		tabSize !== undefined &&
		Number.isInteger(tabSize) &&
		tabSize >= 2 &&
		tabSize <= 8
			? ' '.repeat(tabSize)
			: null;
	const segments = input.split(/(\r\n|\r|\n)/);
	stats.linesProcessed = (segments.length + 1) / 2;

	for (let i = 0; i < segments.length; i += 2) {
		let line = segments[i];
		if (tabReplacement !== null && line.includes('\t')) {
			stats.tabsConverted++;
			line = line.replaceAll('\t', tabReplacement);
		}

		if (line.trim() === '') {
			if (removeEmptyLineSpaces && line) {
				stats.emptyLinesWithSpaces++;
				stats.totalSpacesRemoved += line.length;
				line = '';
			}
		} else if (removeTrailingSpaces) {
			const trimmedLine = line.trimEnd();
			if (line.length !== trimmedLine.length) {
				stats.trailingSpacesRemoved++;
				stats.totalSpacesRemoved += line.length - trimmedLine.length;
				line = trimmedLine;
			}
		}
		segments[i] = line;
	}

	return { output: segments.join(''), stats };
}
