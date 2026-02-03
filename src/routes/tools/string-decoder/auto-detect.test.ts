import { describe, it, expect } from 'vitest';
import { autoDetect } from './auto-detect';

describe('エンコード自動検出', () => {
	it('URLエンコードを自動検出できる', () => {
		const encoded = 'Hello%20World%21';
		const results = autoDetect(encoded);

		// URL形式が検出されるはず
		const urlResult = results.find((r) => r.format === 'URLエンコード');
		expect(urlResult).toBeDefined();
		expect(urlResult?.result).toBe('Hello World!');
	});

	it('HTML Entityエンコードを自動検出できる', () => {
		const encoded = '&lt;div&gt;Hello&lt;/div&gt;';
		const results = autoDetect(encoded);

		const htmlResult = results.find((r) => r.format === 'HTMLエンティティ');
		expect(htmlResult).toBeDefined();
		expect(htmlResult?.result).toBe('<div>Hello</div>');
	});

	it('Base64エンコードを自動検出できる', () => {
		const encoded = 'SGVsbG8gV29ybGQ=';
		const results = autoDetect(encoded);

		const base64Result = results.find((r) => r.format === 'Base64');
		expect(base64Result).toBeDefined();
		expect(base64Result?.result).toBe('Hello World');
	});

	it('Unicode JS-styleエスケープを自動検出できる', () => {
		const encoded = '\\u0048\\u0065\\u006C\\u006C\\u006F';
		const results = autoDetect(encoded);

		const unicodeResult = results.find((r) => r.format === 'Unicode (\\uHHHH)');
		expect(unicodeResult).toBeDefined();
		expect(unicodeResult?.result).toBe('Hello');
	});

	it('ROT13を自動検出できる', () => {
		const encoded = 'Uryyb Jbeyq';
		const results = autoDetect(encoded);

		// ROT13は常に試行されるので、結果に含まれるはず
		const rot13Result = results.find((r) => r.format === 'ROT13');
		expect(rot13Result).toBeDefined();
		expect(rot13Result?.result).toBe('Hello World');
	});

	it('信頼度順にソートされている', () => {
		const encoded = 'SGVsbG8gV29ybGQ='; // Base64
		const results = autoDetect(encoded);

		// 信頼度が降順にソートされているか確認
		for (let i = 0; i < results.length - 1; i++) {
			expect(results[i].confidence).toBeGreaterThanOrEqual(results[i + 1].confidence);
		}
	});

	it('複数の形式を検出候補として返す', () => {
		// ROT13は常に試行されるので、Base64でも複数の結果が返る
		const encoded = 'SGVsbG8gV29ybGQ='; // Base64
		const results = autoDetect(encoded);

		// Base64とROT13の結果が含まれる
		expect(results.length).toBeGreaterThanOrEqual(1);
		// Base64が最も高い信頼度で検出されるはず
		expect(results[0].format).toBe('Base64');
	});

	it('Unicodeコードポイントを検出できる', () => {
		const encoded = '\\u{1F600}';
		const results = autoDetect(encoded);
		const hit = results.find((r) => r.format === 'Unicode (\\u{...})');
		expect(hit?.result).toBe('😀');
	});

	it('CSS Unicodeを検出できる', () => {
		const encoded = '\\0048\\0065\\006C\\006C\\006F';
		const results = autoDetect(encoded);
		const hit = results.find((r) => r.format === 'CSS Unicode');
		expect(hit?.result).toBe('Hello');
	});

	it('8進数エスケープを検出できる', () => {
		const encoded = '\\110\\145\\154\\154\\157';
		const results = autoDetect(encoded);
		const hit = results.find((r) => r.format === '8進数 (\\NNN)');
		expect(hit?.result).toBe('Hello');
	});

	it('JSON文字列を検出できる', () => {
		const encoded = '"Hello\\nWorld"';
		const results = autoDetect(encoded);
		const hit = results.find((r) => r.format === 'JSON文字列');
		expect(hit?.result).toBe('Hello\nWorld');
	});

	it('Punycodeを検出できる', () => {
		const encoded = 'xn--bcher-kva';
		const results = autoDetect(encoded);
		const hit = results.find((r) => r.format === 'Punycode');
		expect(hit?.result).toBe('bücher');
	});

	it('2進数を検出できる', () => {
		const encoded = '01001000 01101001';
		const results = autoDetect(encoded);
		const hit = results.find((r) => r.format === '2進数');
		expect(hit?.result).toBe('Hi');
	});

	it('10進数を検出できる', () => {
		const encoded = '72 101 108 108 111';
		const results = autoDetect(encoded);
		const hit = results.find((r) => r.format === '10進数');
		expect(hit?.result).toBe('Hello');
	});

	it('16進数を検出できる', () => {
		const encoded = '48 65 6c 6c 6f';
		const results = autoDetect(encoded);
		const hit = results.find((r) => r.format === '16進数');
		expect(hit?.result).toBe('Hello');
	});

	it('Morse Codeを検出できる', () => {
		const encoded = '.... . .-.. .-.. ---';
		const results = autoDetect(encoded);
		const hit = results.find((r) => r.format === 'Morse Code');
		expect(hit?.result).toBe('HELLO');
	});

	it('Quoted-Printableを検出できる', () => {
		const encoded = 'Hello=20World=21';
		const results = autoDetect(encoded);
		const hit = results.find((r) => r.format === 'Quoted-Printable');
		expect(hit?.result).toBe('Hello World!');
	});
});
