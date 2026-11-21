export type TableDelimiter = 'tab' | 'comma';

export function detectDelimiter(text: string): TableDelimiter {
	let fieldStart = true;
	let quoted = false;
	let hasComma = false;

	for (const character of text) {
		if (character === '"' && (fieldStart || quoted)) {
			quoted = !quoted;
			fieldStart = true;
		} else if (!quoted && character === '\t') {
			return 'tab';
		} else if (!quoted && (character === '\r' || character === '\n')) {
			if (hasComma) break;
			fieldStart = true;
		} else {
			fieldStart = character === ',';
			if (!quoted && fieldStart) hasComma = true;
		}
	}
	return 'comma';
}

export function parsePlainTable(text: string, delimiter = detectDelimiter(text)): string[][] {
	if (!text.trim() && !text.includes('\t')) return [];

	const separator = delimiter === 'tab' ? '\t' : ',';
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = '';
	let quoted = false;
	let atFieldStart = true;

	for (let index = 0; index < text.length; index++) {
		const character = text[index];
		if (quoted) {
			if (character === '"' && text[index + 1] === '"') {
				cell += '"';
				index++;
			} else if (character === '"') {
				quoted = false;
			} else {
				cell += character;
			}
		} else if (character === '"' && atFieldStart) {
			quoted = true;
			atFieldStart = false;
		} else if (character === separator) {
			row.push(cell);
			cell = '';
			atFieldStart = true;
		} else if (character === '\n' || character === '\r') {
			row.push(cell);
			rows.push(row);
			if (character === '\r' && text[index + 1] === '\n') index++;
			row = [];
			cell = '';
			atFieldStart = true;
		} else {
			cell += character;
			atFieldStart = false;
		}
	}

	if (row.length || !atFieldStart) rows.push([...row, cell]);
	return rows;
}
