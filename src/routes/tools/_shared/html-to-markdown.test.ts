import { describe, expect, it } from 'vitest';
import { convertHtmlToMarkdown, getHtmlEditorSource } from './html-to-markdown';

describe('Markdown変換', () => {
	it('テキストとして入力したHTMLコードを変換する', () => {
		const editor = document.createElement('div');
		editor.innerHTML = '&lt;h1&gt;見出し&lt;/h1&gt;';
		editor.innerText = '<h1>見出し</h1>';
		expect(convertHtmlToMarkdown(getHtmlEditorSource(editor))).toBe('# 見出し');
	});

	it('リッチテキストの文字参照をHTMLタグとして解釈しない', () => {
		const editor = document.createElement('div');
		editor.innerText = '<em>そのまま</em>';
		editor.innerHTML = '<strong>&lt;em&gt;そのまま&lt;/em&gt;</strong>';
		expect(convertHtmlToMarkdown(getHtmlEditorSource(editor))).toBe('**<em>そのまま</em>**');
	});

	it('順序付きリストと部分的な見出しの太字を変換する', () => {
		const html =
			'<h1>一部を<strong>太字</strong>にする</h1><ol start="4"><li>甲</li><li>乙</li></ol>';
		expect(convertHtmlToMarkdown(html, { ignoreBoldInHeader: true })).toBe(
			'# 一部を太字にする\n\n4.  甲\n5.  乙'
		);
		expect(convertHtmlToMarkdown(html)).toContain('# 一部を**太字**にする');
	});

	it('通常のコードブロックでもQuillのコードブロックでもコード内の空行と空白を保持する', () => {
		const html = '<pre><code>一行目\n\n  三行目</code></pre><p>説明</p>';
		const quillHtml =
			'<div class="ql-code-block-container"><div class="ql-code-block">一行目</div><div class="ql-code-block"><br></div><div class="ql-code-block">  三行目</div></div><p>説明</p>';
		const expected = '```\n一行目\n\n  三行目\n```\n\n説明';
		expect(convertHtmlToMarkdown(html)).toBe(expected);
		expect(convertHtmlToMarkdown(quillHtml)).toBe(expected);
	});

	it('段落と元の改行を区別して変換する', () => {
		const html = '<p>一行目<br>二行目</p><p>段落</p>';
		expect(convertHtmlToMarkdown(html, { newLineAsParagraph: true })).toBe(
			'一行目\n\n二行目\n\n段落'
		);
		expect(convertHtmlToMarkdown(html, { preserveLineBreaks: true })).toBe(
			'一行目  \n二行目\n\n段落'
		);
	});

	it('行を含まない表を無視し、表中の縦線をエスケープする', () => {
		expect(convertHtmlToMarkdown('<table><caption>空</caption></table><p>本文</p>')).toBe('本文');
		expect(convertHtmlToMarkdown('<table><tr><th>A | B</th></tr><tr><td>C</td></tr></table>')).toBe(
			'| A \\| B |\n| --- |\n| C |'
		);
	});

	it('スクリプトやスタイルの内容を出力しない', () => {
		expect(
			convertHtmlToMarkdown('<style>body { color: red }</style><script>throw 1</script><p>本文</p>')
		).toBe('本文');
	});

	it('取り消し線と下線を保持する', () => {
		expect(convertHtmlToMarkdown('<p><s>取り消し</s>と<u>下線</u></p>')).toBe(
			'~~取り消し~~と<u>下線</u>'
		);
	});

	it('段落を詰める設定でも表・引用・リストと本文を別ブロックにする', () => {
		const html =
			'<p>甲</p><p>乙</p><table><tr><th>表</th></tr><tr><td>行</td></tr></table>' +
			'<p>丙</p><blockquote><p>引用</p></blockquote><p>丁</p><ol start="4"><li>項目</li></ol>';
		expect(convertHtmlToMarkdown(html)).toBe(
			'甲\n乙\n\n| 表 |\n| --- |\n| 行 |\n\n丙\n\n> 引用\n\n丁\n\n4.  項目'
		);
	});
});
