import { describe, it, expect } from 'vitest';
import { markdownToNotion } from './converter';

describe('Markdown → Notion変換', () => {
	it('単純なテキストの改行を2倍にする', () => {
		const input = 'Line 1\nLine 2\nLine 3';
		const expected = 'Line 1\n\nLine 2\n\nLine 3';
		expect(markdownToNotion(input)).toBe(expected);
	});

	it('コードブロック内の改行は保持する', () => {
		const input = 'Text\n```\ncode\nblock\n```\nText';
		const expected = 'Text\n\n```\ncode\nblock\n```\n\nText';
		expect(markdownToNotion(input)).toBe(expected);
	});

	it('インラインコード内の改行は保持する', () => {
		const input = 'Text `code` more';
		// インラインコードには改行がないが、外側の改行は2倍になる
		expect(markdownToNotion(input)).toBe('Text `code` more');
	});

	it('複数のコードブロックを正しく処理する', () => {
		const input = '```js\ncode1\n```\nText\n```py\ncode2\n```';
		const expected = '```js\ncode1\n```\n\nText\n\n```py\ncode2\n```';
		expect(markdownToNotion(input)).toBe(expected);
	});

	it('空文字列を処理する', () => {
		expect(markdownToNotion('')).toBe('');
	});

	it('入力にプレースホルダー文字列が含まれても壊れない', () => {
		const input = 'Text __CODE_BLOCK__0__\n```\ncode\n```';
		const expected = 'Text __CODE_BLOCK__0__\n\n```\ncode\n```';
		expect(markdownToNotion(input)).toBe(expected);
	});
});
