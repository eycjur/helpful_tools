import { describe, it, expect } from 'vitest';
import {
	decryptCaesar,
	decryptXOR,
	decryptRailFence,
	decryptBase64Multi,
	decryptROT47,
	decryptAtbash,
	decryptReverse
} from './cipher-tools';

describe('暗号解読 - コアロジック', () => {
	describe('Caesar cipher', () => {
		it('ROT13で暗号化されたテキストを復号化できる', () => {
			const encrypted = 'Uryyb Jbeyq'; // "Hello World" in ROT13
			const results = decryptCaesar(encrypted);

			// ROT13はshift=13なので、結果に含まれているはず
			const rot13Result = results.find((r) => r.detail === 'Shift: 13');
			expect(rot13Result).toBeDefined();
			expect(rot13Result?.result).toBe('Hello World');
		});

		it('大文字小文字を保持して復号化する', () => {
			const encrypted = 'Khoor'; // "Hello" with shift=3
			const results = decryptCaesar(encrypted);

			const shift3Result = results.find((r) => r.detail === 'Shift: 3');
			expect(shift3Result?.result).toBe('Hello');
		});

		it('英字以外の文字は変更しない', () => {
			const encrypted = 'Uryyb123!'; // "Hello123!" in ROT13
			const results = decryptCaesar(encrypted);

			const rot13Result = results.find((r) => r.detail === 'Shift: 13');
			expect(rot13Result?.result).toBe('Hello123!');
		});
	});

	describe('XOR single-byte', () => {
		it('XOR暗号化されたテキストを復号化できる', () => {
			// 一般的な英文をXOR暗号化（信頼度が高くなるように長めのテキスト）
			const plaintext = 'The quick brown fox jumps over the lazy dog';
			const key = 42;
			const encrypted = plaintext
				.split('')
				.map((c) => c.charCodeAt(0) ^ key)
				.map((code) => String.fromCharCode(code))
				.join('');

			const results = decryptXOR(encrypted);

			// 結果が返ってくることを確認（信頼度によってkey=42が上位に来るか不定）
			expect(results.length).toBeGreaterThan(0);

			// 正しいkeyでの復号化結果が含まれているか確認
			const allResults = results.map((r) => r.result);
			expect(allResults).toContain(plaintext);
		});

		it('印字可能文字のみを結果に含める', () => {
			const input = 'test';
			const results = decryptXOR(input);

			// すべての結果が印字可能文字のみで構成されているか確認
			for (const result of results) {
				for (const char of result.result) {
					const code = char.charCodeAt(0);
					expect(code).toBeGreaterThanOrEqual(0x20);
					expect(code).toBeLessThanOrEqual(0x7e);
				}
			}
		});
	});

	describe('Rail Fence cipher', () => {
		it('複数のレール数でデコードを試行する', () => {
			const encrypted = 'HELOWRLD';
			const results = decryptRailFence(encrypted);

			// 2-5レールの結果が返ってくることを確認
			expect(results.length).toBeGreaterThan(0);
			expect(results.length).toBeLessThanOrEqual(4); // 2-5レール = 4パターン

			// 信頼度スコアが付与されていることを確認
			for (const result of results) {
				expect(result.confidence).toBeGreaterThanOrEqual(0);
				expect(result.detail).toMatch(/Rails: [2-5]/);
			}
		});

		it('既知のレールフェンス暗号を復号できる', () => {
			// "WEAREDISCOVEREDFLEEATONCE" を 3レールで暗号化した既知例
			const encrypted = 'WECRLTEERDSOEEFEAOCAIVDEN';
			const results = decryptRailFence(encrypted);
			const decrypted = results.map((r) => r.result);
			expect(decrypted).toContain('WEAREDISCOVEREDFLEEATONCE');
		});
	});

	describe('Base64多段デコード', () => {
		it('1段階のBase64をデコードできる', () => {
			const encoded = btoa('Hello World'); // "SGVsbG8gV29ybGQ="
			const results = decryptBase64Multi(encoded);

			expect(results.length).toBeGreaterThan(0);
			// 最初の結果が "Hello World" であること
			expect(results[0].result).toBe('Hello World');
			expect(results[0].detail).toBe('1回デコード');
		});

		it('2段階のBase64をデコードできる', () => {
			const stage1 = btoa('Hello World');
			const stage2 = btoa(stage1);
			const results = decryptBase64Multi(stage2);

			// 2段階分のデコード結果が含まれる
			expect(results.length).toBe(2);
			expect(results[0].detail).toBe('1回デコード');
			expect(results[1].detail).toBe('2回デコード');
			expect(results[1].result).toBe('Hello World');
		});

		it('無限ループを防ぐ（循環検出）', () => {
			const input = 'SGVsbG8gV29ybGQ='; // "Hello World" in Base64
			const results = decryptBase64Multi(input);

			// 循環が検出されて停止するはず（"Hello World" はBase64フォーマットではない）
			expect(results.length).toBeLessThanOrEqual(10);
		});
	});

	describe('ROT47', () => {
		it('ROT47は2回適用すると元に戻る', () => {
			const input = 'Hello, World! 123';
			const first = decryptROT47(input);
			const second = decryptROT47(first.result);
			expect(second.result).toBe(input);
		});
	});

	describe('Atbash cipher', () => {
		it('AtbashでA-Z/a-zを反転できる', () => {
			const result = decryptAtbash('AbcXYZ');
			expect(result.result).toBe('ZyxCBA');
		});
	});

	describe('Reverse', () => {
		it('文字列を逆順にできる', () => {
			const result = decryptReverse('stressed');
			expect(result.result).toBe('desserts');
		});
	});
});
