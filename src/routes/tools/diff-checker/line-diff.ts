import { createTwoFilesPatch, diffArrays } from 'diff';

export type LineDiffRow = { leftText: string | null; rightText: string | null };

export function alignDiffLines(left: string, right: string): LineDiffRow[] {
	const diffs = diffArrays(left ? left.split('\n') : [], right ? right.split('\n') : []);
	const rows: LineDiffRow[] = [];

	for (let i = 0; i < diffs.length; i++) {
		const part = diffs[i];
		if (part.removed) {
			const next = diffs[i + 1];
			const additions = next?.added ? next.value : [];
			if (next?.added) i++;
			for (let j = 0; j < Math.max(part.value.length, additions.length); j++) {
				rows.push({ leftText: part.value[j] ?? null, rightText: additions[j] ?? null });
			}
		} else {
			for (const line of part.value) {
				rows.push({ leftText: part.added ? null : line, rightText: line });
			}
		}
	}

	return rows;
}

export function createUnifiedDiff(left: string, right: string): string {
	return createTwoFilesPatch('Left Text', 'Right Text', left, right);
}
