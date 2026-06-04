import { markdownToDelta, quillDeltaToMarkdown } from '@slackfmt/core';

export interface SlackConvertResult {
	deltaJson: string;
	previewMarkdown: string;
}

/**
 * Markdown を Slack の Quill Delta（slack/texty）形式に変換する
 */
export function markdownToSlack(markdown: string): SlackConvertResult | null {
	const trimmed = markdown.trim();
	if (!trimmed) return null;

	const deltaJson = markdownToDelta(trimmed);
	const previewMarkdown = quillDeltaToMarkdown(deltaJson);
	return { deltaJson, previewMarkdown };
}

/**
 * Slack 用リッチテキストをクリップボードに書き込む（slack/texty + text/plain）
 * カスタム MIME のため execCommand を使用（入力中のユーザ操作から呼び出し可能）
 */
export function copyMarkdownToSlackClipboard(markdown: string, deltaJson: string): boolean {
	if (!markdown.trim() || !deltaJson) return false;

	document.oncopy = (e) => {
		e.preventDefault();
		e.clipboardData?.setData('text/plain', markdown);
		e.clipboardData?.setData('slack/texty', deltaJson);
	};

	try {
		return document.execCommand('copy');
	} finally {
		document.oncopy = null;
	}
}
