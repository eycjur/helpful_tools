import { applyPatch } from 'diff';
import { describe, expect, it } from 'vitest';
import { alignDiffLines, createUnifiedDiff } from './line-diff';

describe('alignDiffLines', () => {
	it('aligns an inserted line without marking its neighboring lines as modified', () => {
		expect(alignDiffLines('A\nB\nC', 'A\nX\nB\nC')).toEqual([
			{ leftText: 'A', rightText: 'A' },
			{ leftText: null, rightText: 'X' },
			{ leftText: 'B', rightText: 'B' },
			{ leftText: 'C', rightText: 'C' }
		]);
	});

	it('pairs changed lines before showing extra deletions', () => {
		expect(alignDiffLines('one\ntwo\nthree', 'ONE\nTWO')).toEqual([
			{ leftText: 'one', rightText: 'ONE' },
			{ leftText: 'two', rightText: 'TWO' },
			{ leftText: 'three', rightText: null }
		]);
	});

	it('keeps blank lines distinct from missing rows', () => {
		expect(alignDiffLines('A\n', 'A')).toEqual([
			{ leftText: 'A', rightText: 'A' },
			{ leftText: '', rightText: null }
		]);
		expect(alignDiffLines('', 'A\nB')).toEqual([
			{ leftText: null, rightText: 'A' },
			{ leftText: null, rightText: 'B' }
		]);
	});
});

describe('createUnifiedDiff', () => {
	it.each([
		['A\nB', 'A\nX\nB\n'],
		['', 'A'],
		['A\n', '']
	])('produces an applicable patch for %j → %j', (left, right) => {
		const patch = createUnifiedDiff(left, right);
		expect(patch).toContain('@@');
		expect(applyPatch(left, patch)).toBe(right);
	});
});
