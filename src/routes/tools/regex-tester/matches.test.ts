import { describe, expect, it } from 'vitest';
import { findMatches } from './matches';

describe('正規表現テスター', () => {
	it('Unicodeのゼロ幅一致で絵文字の途中へ進まない', () => {
		expect(findMatches(/(?=.)/gu, '😀A').map(({ index }) => index)).toEqual([0, 2]);
		expect(findMatches(/(?=.)/g, '😀A').map(({ index }) => index)).toEqual([0, 1, 2]);
	});

	it('絵文字の長さを1文字と数え、位置はJavaScriptのインデックスを返す', () => {
		expect(findMatches(/(?<letter>.)/gu, '😀A')).toMatchObject([
			{ index: 0, length: 1, text: '😀', captures: ['😀'], groups: { letter: '😀' } },
			{ index: 2, length: 1, text: 'A', captures: ['A'], groups: { letter: 'A' } }
		]);
	});

	it('gフラグを外すと最初の一致だけ返し、一致しない場合は空になる', () => {
		expect(findMatches(/a/i, 'A a').map(({ text }) => text)).toEqual(['A']);
		expect(findMatches(/a/i, 'b')).toEqual([]);
	});
});
