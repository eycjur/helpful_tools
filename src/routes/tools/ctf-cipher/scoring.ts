/**
 * CTF暗号解読 - 信頼度評価システム
 */

import { SvelteSet, SvelteMap } from 'svelte/reactivity';

// 英語の一般的な単語リスト（CTF関連用語を含む）
const COMMON_WORD_LIST = [
	'the',
	'be',
	'to',
	'of',
	'and',
	'a',
	'in',
	'that',
	'have',
	'i',
	'it',
	'for',
	'not',
	'on',
	'with',
	'he',
	'as',
	'you',
	'do',
	'at',
	'this',
	'but',
	'his',
	'by',
	'from',
	'they',
	'we',
	'say',
	'her',
	'she',
	'or',
	'an',
	'will',
	'my',
	'one',
	'all',
	'would',
	'there',
	'their',
	'what',
	'so',
	'up',
	'out',
	'if',
	'about',
	'who',
	'get',
	'which',
	'go',
	'me',
	'when',
	'make',
	'can',
	'like',
	'time',
	'no',
	'just',
	'him',
	'know',
	'take',
	'people',
	'into',
	'year',
	'your',
	'good',
	'some',
	'could',
	'them',
	'see',
	'other',
	'than',
	'then',
	'now',
	'look',
	'only',
	'come',
	'its',
	'over',
	'think',
	'also',
	'back',
	'after',
	'use',
	'two',
	'how',
	'our',
	'work',
	'first',
	'well',
	'way',
	'even',
	'new',
	'want',
	'because',
	'any',
	'these',
	'give',
	'day',
	'most',
	'us',
	'flag',
	'flags',
	'hint',
	'hints',
	'ctf',
	'crypto',
	'cipher',
	'decode',
	'encoded',
	'plain',
	'plaintext',
	'key',
	'keys',
	'challenge',
	'challenges',
	'solve',
	'solved',
	'answer',
	'answers',
	'check',
	'verify',
	'submit',
	'submitted'
];

const COMMON_WORDS = new Map(
	COMMON_WORD_LIST.map((word, index) => [word, 1 - index / COMMON_WORD_LIST.length])
);

// 英語の頻出バイグラム（2文字組み合わせ）
const ENGLISH_BIGRAMS = [
	'th',
	'he',
	'in',
	'er',
	'an',
	're',
	'on',
	'at',
	'en',
	'nd',
	'ti',
	'es',
	'or',
	'te',
	'of',
	'ed',
	'is',
	'it',
	'al',
	'ar',
	'st',
	'to',
	'nt',
	'ng',
	'se',
	'ha',
	'as',
	'ou',
	'io',
	'le'
];

/**
 * 総合的な信頼度を計算（0-100）
 * 印字可能文字、単語の出現、文字頻度などを総合評価
 */
export function calculateGeneralConfidence(text: string): number {
	const len = text.length;
	if (len === 0) return 0;

	const printable = text.match(/[\x20-\x7E]/g)?.length || 0;
	const whitespace = text.match(/\s/g)?.length || 0;
	const letters = text.match(/[A-Za-z]/g)?.length || 0;
	const digits = text.match(/[0-9]/g)?.length || 0;
	const lettersDigits = letters + digits;
	const punctuation = text.match(/[.,;:'"!?()[\]{}<>/\\\-_=+@#$%^&*]/g)?.length || 0;
	const uniqueChars = new SvelteSet(text).size;
	const wordMatches = text.match(/[A-Za-z]{2,}/g) || [];
	const wordLikeCount = wordMatches.reduce((sum, word) => sum + word.length, 0);
	const avgWordLength =
		wordMatches.length > 0
			? wordMatches.reduce((sum, word) => sum + word.length, 0) / wordMatches.length
			: 0;
	const vowelCount = text.match(/[AEIOUaeiou]/g)?.length || 0;
	const entropy = calculateShannonEntropy(text);

	const printableRatio = printable / len;
	const whitespaceRatio = whitespace / len;
	const lettersDigitsRatio = lettersDigits / len;
	const punctuationRatio = punctuation / len;
	const diversityRatio = uniqueChars / len;
	const wordLikeRatio = wordLikeCount / len;
	const vowelRatio = letters > 0 ? vowelCount / letters : 0;
	const { wordHitRatio, wordWeightAvg } = calculateWordCommonness(text);
	const bigramRatio = calculateBigramRatio(text);

	let score = 0;
	score += printableRatio * 32;
	score += scoreInRange(whitespaceRatio, 0.05, 0.3, 11);
	score += scoreInRange(lettersDigitsRatio, 0.4, 0.95, 11);
	score += scoreInRange(punctuationRatio, 0.01, 0.18, 3);
	score += scoreInRange(diversityRatio, 0.2, 0.7, 7);
	score += scoreInRange(entropy, 3.2, 5.2, 10);
	score += scoreInRange(wordLikeRatio, 0.2, 0.8, 7);
	score += scoreInRange(avgWordLength, 3, 8, 5);
	if (letters > 0) {
		score += scoreInRange(vowelRatio, 0.2, 0.55, 5);
	}
	score += scoreInRange(wordHitRatio, 0.08, 0.4, 16);
	score += scoreInRange(wordWeightAvg, 0.2, 0.8, 7);
	score += scoreInRange(bigramRatio, 0.15, 0.55, 10);

	const maxRun = getMaxRunLength(text);
	if (maxRun > 8) {
		score -= (maxRun - 8) * 2;
	}

	const nonPrintableRatio = 1 - printableRatio;
	if (nonPrintableRatio > 0) {
		score -= nonPrintableRatio * 30;
	}

	const digitRatio = digits / len;
	if (digitRatio > 0.5 && lettersDigitsRatio < 0.7) {
		score -= (digitRatio - 0.5) * 20;
	}

	const nonWordRatio = 1 - (lettersDigits + whitespace) / len;
	if (nonWordRatio > 0.25) {
		score -= (nonWordRatio - 0.25) * 50;
	}

	if (punctuationRatio > 0.18) {
		score -= (punctuationRatio - 0.18) * 45;
	}

	const adjusted = 100 * Math.tanh(score / 110);
	return Math.max(0, Math.round(adjusted));
}

/**
 * 範囲内スコアリング（理想範囲に近いほど高スコア）
 */
function scoreInRange(value: number, min: number, max: number, weight: number): number {
	if (value <= 0) return 0;
	if (value < min) return weight * (value / min);
	if (value > max) return weight * (1 - (value - max) / (1 - max));
	return weight;
}

/**
 * 最大連続文字数を計算
 */
function getMaxRunLength(text: string): number {
	let maxRun = 1;
	let currentRun = 1;
	for (let i = 1; i < text.length; i++) {
		if (text[i] === text[i - 1]) {
			currentRun += 1;
			if (currentRun > maxRun) maxRun = currentRun;
		} else {
			currentRun = 1;
		}
	}
	return maxRun;
}

/**
 * Shannonエントロピーを計算（情報量の尺度）
 */
function calculateShannonEntropy(text: string): number {
	const len = text.length;
	if (len === 0) return 0;
	const freq = new SvelteMap<string, number>();
	for (const char of text) {
		freq.set(char, (freq.get(char) || 0) + 1);
	}
	let entropy = 0;
	for (const count of freq.values()) {
		const p = count / len;
		entropy -= p * Math.log2(p);
	}
	return entropy;
}

/**
 * 一般的な英単語の出現率を計算
 */
function calculateWordCommonness(text: string): {
	wordHitRatio: number;
	wordWeightAvg: number;
} {
	const words = text.toLowerCase().match(/[a-z]{2,}/g) || [];
	if (words.length === 0) return { wordHitRatio: 0, wordWeightAvg: 0 };
	let hitCount = 0;
	let weightSum = 0;
	for (const word of words) {
		const weight = COMMON_WORDS.get(word);
		if (weight !== undefined) {
			hitCount += 1;
			weightSum += weight;
		}
	}
	return {
		wordHitRatio: hitCount / words.length,
		wordWeightAvg: hitCount > 0 ? weightSum / hitCount : 0
	};
}

/**
 * 英語バイグラムの出現率を計算
 */
function calculateBigramRatio(text: string): number {
	const lettersOnly = text.toLowerCase().replace(/[^a-z]/g, '');
	if (lettersOnly.length < 2) return 0;
	let total = 0;
	let hits = 0;
	for (let i = 0; i < lettersOnly.length - 1; i++) {
		const bg = lettersOnly.slice(i, i + 2);
		total += 1;
		if (ENGLISH_BIGRAMS.includes(bg)) {
			hits += 1;
		}
	}
	return total > 0 ? hits / total : 0;
}
