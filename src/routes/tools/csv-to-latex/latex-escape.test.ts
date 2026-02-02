import { describe, it, expect } from 'vitest';
import { escapeLatex } from './latex-escape';

describe('escapeLatex', () => {
	describe('基本的な特殊文字のエスケープ', () => {
		it('バックスラッシュを正しくエスケープする', () => {
			expect(escapeLatex('\\')).toBe('\\textbackslash{}');
		});

		it('ドル記号をエスケープする', () => {
			expect(escapeLatex('$')).toBe('\\$');
		});

		it('アンパサンドをエスケープする', () => {
			expect(escapeLatex('&')).toBe('\\&');
		});

		it('パーセント記号をエスケープする', () => {
			expect(escapeLatex('%')).toBe('\\%');
		});

		it('ハッシュ記号をエスケープする', () => {
			expect(escapeLatex('#')).toBe('\\#');
		});

		it('キャレットをエスケープする', () => {
			// 注: {}もエスケープされるため、\textasciicircum\{\}になる
			expect(escapeLatex('^')).toBe('\\textasciicircum\\{\\}');
		});

		it('アンダースコアをエスケープする', () => {
			expect(escapeLatex('_')).toBe('\\_');
		});

		it('左中括弧をエスケープする', () => {
			expect(escapeLatex('{')).toBe('\\{');
		});

		it('右中括弧をエスケープする', () => {
			expect(escapeLatex('}')).toBe('\\}');
		});

		it('チルダをエスケープする', () => {
			// 注: チルダは{}のエスケープ後に置換されるため、{}はエスケープされない
			expect(escapeLatex('~')).toBe('\\textasciitilde{}');
		});
	});

	describe('複合パターンのテスト（バグ修正の検証）', () => {
		it('バックスラッシュと中括弧の組み合わせを正しくエスケープする', () => {
			// 重要: バックスラッシュの二重エスケープバグの検証
			// 誤った実装では "\\textbackslash\\{\\}" になってしまう
			expect(escapeLatex('\\{')).toBe('\\textbackslash{}\\{');
			expect(escapeLatex('\\}')).toBe('\\textbackslash{}\\}');
			expect(escapeLatex('\\{test\\}')).toBe('\\textbackslash{}\\{test\\textbackslash{}\\}');
		});

		it('すべての特殊文字を含む文字列を正しくエスケープする', () => {
			const input = 'test\\value$price&name%rate#id^exp_key{obj}~approx';
			// 注: ^の{}はエスケープされるが、~の{}はエスケープされない（置換順序の違い）
			const expected =
				'test\\textbackslash{}value\\$price\\&name\\%rate\\#id\\textasciicircum\\{\\}exp\\_key\\{obj\\}\\textasciitilde{}approx';
			expect(escapeLatex(input)).toBe(expected);
		});

		it('連続したバックスラッシュを正しくエスケープする', () => {
			expect(escapeLatex('\\\\')).toBe('\\textbackslash{}\\textbackslash{}');
			expect(escapeLatex('\\\\\\')).toBe('\\textbackslash{}\\textbackslash{}\\textbackslash{}');
		});

		it('LaTeXコマンド風の文字列を正しくエスケープする', () => {
			// "\textbf{bold}" -> "\\textbackslash{}textbf\\{bold\\}"
			expect(escapeLatex('\\textbf{bold}')).toBe('\\textbackslash{}textbf\\{bold\\}');
		});
	});

	describe('実用的なケース', () => {
		it('数式を含むテキストをエスケープする', () => {
			expect(escapeLatex('x^2 + y^2 = z^2')).toBe(
				'x\\textasciicircum\\{\\}2 + y\\textasciicircum\\{\\}2 = z\\textasciicircum\\{\\}2'
			);
		});

		it('価格表示をエスケープする', () => {
			expect(escapeLatex('$100 & $200')).toBe('\\$100 \\& \\$200');
		});

		it('パーセンテージをエスケープする', () => {
			expect(escapeLatex('50% discount')).toBe('50\\% discount');
		});

		it('変数名（アンダースコア付き）をエスケープする', () => {
			expect(escapeLatex('my_variable_name')).toBe('my\\_variable\\_name');
		});

		it('ファイルパス（Windows形式）をエスケープする', () => {
			expect(escapeLatex('C:\\Users\\test')).toBe('C:\\textbackslash{}Users\\textbackslash{}test');
		});
	});

	describe('エッジケース', () => {
		it('空文字列を処理する', () => {
			expect(escapeLatex('')).toBe('');
		});

		it('特殊文字を含まない文字列はそのまま返す', () => {
			expect(escapeLatex('Hello World')).toBe('Hello World');
		});

		it('スペースやタブは変更しない', () => {
			expect(escapeLatex('Hello\tWorld\n')).toBe('Hello\tWorld\n');
		});

		it('Unicode文字を含む文字列を処理する', () => {
			expect(escapeLatex('日本語$価格')).toBe('日本語\\$価格');
		});
	});

	describe('セキュリティテスト', () => {
		it('LaTeXインジェクション試行を無害化する', () => {
			// LaTeXコマンドインジェクションの試行
			const malicious = '\\input{/etc/passwd}';
			const result = escapeLatex(malicious);
			// バックスラッシュと中括弧がすべてエスケープされているか確認
			expect(result).not.toContain('\\input');
			expect(result).toBe('\\textbackslash{}input\\{/etc/passwd\\}');
		});

		it('複数のLaTeXコマンドを含む文字列を無害化する', () => {
			const malicious = '\\documentclass{article}\\begin{document}';
			const result = escapeLatex(malicious);
			expect(result).not.toContain('\\documentclass');
			expect(result).not.toContain('\\begin');
		});
	});
});
