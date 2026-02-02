import { describe, it, expect } from 'vitest';
import { escapeHtml } from './html-escape';

describe('escapeHtml', () => {
	describe('基本的なHTML特殊文字のエスケープ', () => {
		it('アンパサンドをエスケープする', () => {
			expect(escapeHtml('&')).toBe('&amp;');
		});

		it('小なり記号をエスケープする', () => {
			expect(escapeHtml('<')).toBe('&lt;');
		});

		it('大なり記号をエスケープする', () => {
			expect(escapeHtml('>')).toBe('&gt;');
		});

		it('ダブルクォートをエスケープする', () => {
			expect(escapeHtml('"')).toBe('&quot;');
		});

		it('シングルクォートをエスケープする', () => {
			expect(escapeHtml("'")).toBe('&#x27;');
		});
	});

	describe('XSS攻撃パターンの無害化', () => {
		it('基本的なscriptタグを無害化する', () => {
			const xss = '<script>alert("XSS")</script>';
			const result = escapeHtml(xss);
			expect(result).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
			// scriptタグとして解釈されないことを確認
			expect(result).not.toContain('<script>');
		});

		it('imgタグのonerrorイベントを無害化する', () => {
			const xss = '<img src=x onerror="alert(\'XSS\')">';
			const result = escapeHtml(xss);
			expect(result).toBe('&lt;img src=x onerror=&quot;alert(&#x27;XSS&#x27;)&quot;&gt;');
			expect(result).not.toContain('<img');
		});

		it('iframeタグを無害化する', () => {
			const xss = '<iframe src="javascript:alert(\'XSS\')"></iframe>';
			const result = escapeHtml(xss);
			expect(result).toContain('&lt;iframe');
			expect(result).not.toContain('<iframe');
		});

		it('aタグのhref属性にJavaScriptを含む場合を無害化する', () => {
			const xss = '<a href="javascript:void(0)">Click</a>';
			const result = escapeHtml(xss);
			expect(result).not.toContain('<a');
			expect(result).toContain('&lt;a');
		});

		it('styleタグを無害化する', () => {
			const xss = '<style>body{background:url("javascript:alert(\'XSS\')")}</style>';
			const result = escapeHtml(xss);
			expect(result).not.toContain('<style>');
			expect(result).toContain('&lt;style&gt;');
		});

		it('HTMLコメント内のスクリプトを無害化する', () => {
			const xss = '<!--<script>alert("XSS")</script>-->';
			const result = escapeHtml(xss);
			expect(result).not.toContain('<!--');
			expect(result).toContain('&lt;!--');
		});
	});

	describe('複雑なXSS攻撃パターン', () => {
		it('複数のクォートタイプを含むXSSを無害化する', () => {
			const xss = `<div onclick="alert('XSS')" onmouseover="alert(\\"XSS2\\")">`;
			const result = escapeHtml(xss);
			expect(result).not.toContain('<div');
			// onclickという単語自体は無害（属性として機能しない）
			// 重要なのは、タグとクォートがエスケープされていること
			expect(result).toContain('&lt;div');
			expect(result).toContain('&gt;');
			// すべてのクォートがエスケープされていることを確認
			expect(result).toContain('&quot;');
			expect(result).toContain('&#x27;');
		});

		it('HTMLエンティティを使用したXSS試行を無害化する', () => {
			const xss = '&lt;script&gt;alert("XSS")&lt;/script&gt;';
			const result = escapeHtml(xss);
			// 既にエンティティ化されている文字もさらにエスケープされる
			expect(result).toBe('&amp;lt;script&amp;gt;alert(&quot;XSS&quot;)&amp;lt;/script&amp;gt;');
		});

		it('属性値内のシングルクォートを無害化する', () => {
			const xss = "<img alt='test' onerror='alert(1)'>";
			const result = escapeHtml(xss);
			expect(result).not.toContain('<img');
			expect(result).not.toContain("onerror='");
			// シングルクォートが&#x27;にエスケープされていることを確認
			expect(result).toContain('&#x27;');
		});
	});

	describe('エッジケースと実用的なテスト', () => {
		it('空文字列を処理する', () => {
			expect(escapeHtml('')).toBe('');
		});

		it('特殊文字を含まない文字列はそのまま返す', () => {
			expect(escapeHtml('Hello World')).toBe('Hello World');
		});

		it('すべての特殊文字を含む文字列を正しくエスケープする', () => {
			const input = `Test & "quotes" and <tags> with 'apostrophes'`;
			const expected = `Test &amp; &quot;quotes&quot; and &lt;tags&gt; with &#x27;apostrophes&#x27;`;
			expect(escapeHtml(input)).toBe(expected);
		});

		it('改行やタブは変更しない', () => {
			expect(escapeHtml('Line1\nLine2\tTab')).toBe('Line1\nLine2\tTab');
		});

		it('Unicode文字を含む文字列を処理する', () => {
			expect(escapeHtml('日本語<テスト>')).toBe('日本語&lt;テスト&gt;');
		});

		it('連続した特殊文字を正しくエスケープする', () => {
			expect(escapeHtml('<<<')).toBe('&lt;&lt;&lt;');
			expect(escapeHtml('&&&')).toBe('&amp;&amp;&amp;');
		});
	});

	describe('Diffチェッカー特有のケース', () => {
		it('差分表示用のHTMLスニペットを無害化する', () => {
			const diff = '<span class="added">+ New Line</span>';
			const result = escapeHtml(diff);
			// spanタグがエスケープされているか確認
			expect(result).not.toContain('<span');
			expect(result).toContain('&lt;span');
		});

		it('コードスニペット内のHTMLを無害化する', () => {
			const code = 'const html = "<div>Hello</div>";';
			const result = escapeHtml(code);
			expect(result).toBe('const html = &quot;&lt;div&gt;Hello&lt;/div&gt;&quot;;');
		});

		it('XMLやHTMLタグを含むテキストを無害化する', () => {
			const xml = '<?xml version="1.0"?><root><item>test</item></root>';
			const result = escapeHtml(xml);
			expect(result).not.toContain('<?xml');
			expect(result).not.toContain('<root>');
			expect(result).toContain('&lt;');
			expect(result).toContain('&gt;');
			expect(result).toContain('&quot;');
		});
	});

	describe('セキュリティ回帰テスト', () => {
		it('修正前のバグ：シングルクォートがエスケープされていない（CVE相当）', () => {
			// 修正前: シングルクォートがエスケープされずXSS可能だった
			const xss = "test' onload='alert(1)";
			const result = escapeHtml(xss);
			// シングルクォートが必ずエスケープされることを確認
			expect(result).toContain('&#x27;');
			expect(result).not.toContain("'");
		});

		it('修正前のバグ：ダブルクォートがエスケープされていない（CVE相当）', () => {
			// 修正前: ダブルクォートがエスケープされずXSS可能だった
			const xss = 'test" onload="alert(1)';
			const result = escapeHtml(xss);
			// ダブルクォートが必ずエスケープされることを確認
			expect(result).toContain('&quot;');
			expect(result).not.toContain('"');
		});
	});
});
