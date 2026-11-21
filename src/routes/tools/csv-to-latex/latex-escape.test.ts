import { describe, it, expect } from 'vitest';
import { escapeLatex, formatLatexCell } from './latex-escape';

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
			expect(escapeLatex('^')).toBe('\\textasciicircum{}');
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
			const expected =
				'test\\textbackslash{}value\\$price\\&name\\%rate\\#id\\textasciicircum{}exp\\_key\\{obj\\}\\textasciitilde{}approx';
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
				'x\\textasciicircum{}2 + y\\textasciicircum{}2 = z\\textasciicircum{}2'
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

		it('私用領域の文字をそのまま保持する', () => {
			expect(escapeLatex('\uE000')).toBe('\uE000');
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

describe('formatLatexCell', () => {
	it('1行のセルは特殊文字だけを変換する', () => {
		expect(formatLatexCell('A&B')).toBe('A\\&B');
	});

	it.each(['[1]', '*', ' [1]', '\t* note'])(
		'行頭の %j を直前の行末コマンドから分離する',
		(cell) => {
			expect(formatLatexCell(cell)).toBe('{}' + cell);
		}
	);

	it('空行を含む複数行を同じセルに保持し、角括弧を行間の指定と区別する', () => {
		expect(formatLatexCell('A&B\r\n\r\n[1]')).toBe(
			'\\shortstack[l]{\\strut A\\&B \\\\ \\strut  \\\\ \\strut [1]}'
		);
	});
});
