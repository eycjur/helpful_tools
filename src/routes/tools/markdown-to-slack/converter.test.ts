import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { markdownToSlack, copyMarkdownToSlackClipboard } from './converter';

describe('markdownToSlack', () => {
	it('空文字列は null を返す', () => {
		expect(markdownToSlack('')).toBeNull();
		expect(markdownToSlack('   ')).toBeNull();
	});

	it('太字を含む Delta JSON を生成する', () => {
		const result = markdownToSlack('**bold** text');
		expect(result).not.toBeNull();
		expect(result!.deltaJson).toContain('"ops"');
		expect(result!.previewMarkdown).toContain('bold');
	});

	it('リンクを含む変換ができる', () => {
		const result = markdownToSlack('[Slack](https://slack.com)');
		expect(result).not.toBeNull();
		expect(result!.deltaJson).toContain('ops');
	});
});

describe('copyMarkdownToSlackClipboard', () => {
	const execCommand = vi.fn(() => true);

	beforeEach(() => {
		execCommand.mockClear();
		// happy-dom では execCommand が未定義のためスタブ
		document.execCommand = execCommand;
	});

	afterEach(() => {
		// @ts-expect-error restore test stub
		delete document.execCommand;
	});

	it('空入力では false', () => {
		expect(copyMarkdownToSlackClipboard('', '')).toBe(false);
	});

	it('execCommand("copy") を呼び出す', () => {
		expect(copyMarkdownToSlackClipboard('**hi**', '{"ops":[{"insert":"hi"}]}')).toBe(true);
		expect(document.execCommand).toHaveBeenCalledWith('copy');
	});
});
