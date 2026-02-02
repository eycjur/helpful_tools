import { describe, it, expect } from 'vitest';
import { calculateGeneralConfidence } from './scoring';

describe('信頼度評価システム', () => {
	describe('calculateGeneralConfidence', () => {
		it('すべて印字可能文字の平文は高スコアを得る', () => {
			const plaintext = 'This is a test message with common words.';
			const score = calculateGeneralConfidence(plaintext);

			// 印字可能文字100% + 英単語出現 + 文字頻度 = 高スコア
			expect(score).toBeGreaterThan(50);
		});

		it('一般的な英単語を含むテキストは高スコアを得る', () => {
			const text = 'the quick brown fox jumps over the lazy dog';
			const score = calculateGeneralConfidence(text);

			// "the" が2回出現 + 他の一般単語 = 高スコア
			expect(score).toBeGreaterThan(60);
		});

		it('ランダムな文字列は平文より低いスコアを得る', () => {
			const random = 'xqzjkwvbpmfglnh';
			const plaintext = 'the quick brown fox';

			const randomScore = calculateGeneralConfidence(random);
			const plaintextScore = calculateGeneralConfidence(plaintext);

			// ランダム文字列は平文よりスコアが低い
			expect(randomScore).toBeLessThan(plaintextScore);
		});

		it('印字不可能文字を含む文字列は純粋な平文より低いスコアを得る', () => {
			const withUnprintable = 'Hello\x00\x01\x02World';
			const plaintext = 'Hello World';

			const unprintableScore = calculateGeneralConfidence(withUnprintable);
			const plaintextScore = calculateGeneralConfidence(plaintext);

			// 印字不可能文字があるため、純粋な平文よりスコアが低い
			expect(unprintableScore).toBeLessThan(plaintextScore);
		});

		it('空文字列は0スコアを返す', () => {
			const score = calculateGeneralConfidence('');
			expect(score).toBe(0);
		});

		it('英語頻出文字（ETAOIN）を多く含むテキストは高スコアを得る', () => {
			// 頻出文字を意図的に多く含む
			const text = 'eee ttt aaa ooo iii nnn';
			const score = calculateGeneralConfidence(text);

			// 文字頻度スコアが高いはず
			expect(score).toBeGreaterThan(30);
		});
	});
});
