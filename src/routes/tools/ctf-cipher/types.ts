/**
 * CTF暗号解読ツールの型定義
 */

export interface DecryptResult {
	cipher: string;
	result: string;
	confidence: number; // 0-100
	detail?: string;
}

export interface DecryptGroup {
	cipher: string;
	results: DecryptResult[];
	maxConfidence: number;
}
