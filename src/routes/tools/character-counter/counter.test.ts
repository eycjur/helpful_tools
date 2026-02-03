import { describe, it, expect } from 'vitest';
import { countGraphemes, countBytes, countLines } from './counter';

describe('文字数カウンタ - コアロジック', () => {
	describe('countGraphemes', () => {
		it('ASCII文字を正確にカウントする', () => {
			expect(countGraphemes('Hello')).toBe(5);
			expect(countGraphemes('Hello World')).toBe(11);
		});

		it('日本語文字を正確にカウントする', () => {
			expect(countGraphemes('こんにちは')).toBe(5);
			expect(countGraphemes('東京都')).toBe(3);
		});

		it('絵文字を1文字としてカウントする', () => {
			// 単純な絵文字
			expect(countGraphemes('👍')).toBe(1);
			expect(countGraphemes('😀😁😂')).toBe(3);

			// サロゲートペアの絵文字
			expect(countGraphemes('🎉')).toBe(1);
		});

		it('肌色の絵文字（結合文字）を1文字としてカウントする', () => {
			// 👍🏻 は「👍」+ ZWJ + 「🏻」で構成されるが、見た目は1文字
			expect(countGraphemes('👍🏻')).toBe(1);
		});

		it('国旗絵文字を1文字としてカウントする', () => {
			// 🇯🇵 は「🇯」+「🇵」の2つの地域指標シンボルで構成されるが、見た目は1文字
			expect(countGraphemes('🇯🇵')).toBe(1);
			expect(countGraphemes('🇺🇸')).toBe(1);
		});

		it('合成文字を正確にカウントする', () => {
			// é は「e」+「́」（結合文字）で構成される場合がある
			expect(countGraphemes('café')).toBe(4);
		});

		it('空文字列は0を返す', () => {
			expect(countGraphemes('')).toBe(0);
		});
	});

	describe('countBytes', () => {
		it('ASCII文字のバイト数を正確に計算する', () => {
			// ASCII文字は1バイト
			expect(countBytes('Hello')).toBe(5);
		});

		it('日本語文字のバイト数を正確に計算する（UTF-8）', () => {
			// ひらがな・カタカナは3バイト
			expect(countBytes('あ')).toBe(3);
			expect(countBytes('こんにちは')).toBe(15); // 3 * 5

			// 漢字も3バイト
			expect(countBytes('東京')).toBe(6); // 3 * 2
		});

		it('絵文字のバイト数を正確に計算する', () => {
			// 基本的な絵文字は4バイト
			expect(countBytes('😀')).toBe(4);

			// 肌色絵文字はさらに多い（ZWJ sequenceのため）
			expect(countBytes('👍🏻')).toBeGreaterThan(4);
		});

		it('空文字列は0を返す', () => {
			expect(countBytes('')).toBe(0);
		});

		it('混在した文字列のバイト数を正確に計算する', () => {
			const text = 'Hello世界'; // "Hello" (5) + "世界" (6) = 11
			expect(countBytes(text)).toBe(11);
		});
	});

	describe('countLines', () => {
		it('単一行のテキストは1を返す', () => {
			expect(countLines('Hello')).toBe(1);
		});

		it('改行を含むテキストの行数を正確にカウントする', () => {
			expect(countLines('line1\nline2')).toBe(2);
			expect(countLines('line1\nline2\nline3')).toBe(3);
		});

		it('末尾の改行も行としてカウントする', () => {
			expect(countLines('line1\n')).toBe(2);
			expect(countLines('line1\nline2\n')).toBe(3);
		});

		it('連続した改行を正確にカウントする', () => {
			expect(countLines('line1\n\nline3')).toBe(3); // 空行も1行
		});

		it('空文字列は0を返す', () => {
			expect(countLines('')).toBe(0);
		});

		it('Windows改行(\\r\\n)を1改行としてカウントする', () => {
			expect(countLines('line1\r\nline2')).toBe(2);
		});

		it('\\rのみの場合は1行として扱う', () => {
			expect(countLines('line1\rline2')).toBe(1);
		});
	});
});
