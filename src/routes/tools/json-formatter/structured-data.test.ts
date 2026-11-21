import { describe, expect, it } from 'vitest';
import { isPythonObject, parseStructuredData } from './structured-data';

describe('構造化データの解析', () => {
	it.each(['0', 'false', 'null', '""'])('トップレベルの %s を保持する', (input) => {
		expect(JSON.stringify(parseStructuredData(input))).toBe(input);
	});

	it('Pythonの値・リテラル・辞書キーを区別する', () => {
		const parsed = parseStructuredData(
			"ModelResponse(text='None, True and False', dict={'a:b': [None, True, False]},)"
		);
		expect(isPythonObject(parsed)).toBe(true);
		expect(JSON.parse(JSON.stringify(parsed))).toEqual({
			__class__: 'ModelResponse',
			text: 'None, True and False',
			dict: { 'a:b': [null, true, false] }
		});
	});

	it('エスケープされた引用符と偶数個のバックスラッシュを扱う', () => {
		const parsed = parseStructuredData(String.raw`A(text='it\'s', path='dir\\', next=1)`);
		expect(parsed).toMatchObject({ text: "it's", path: 'dir\\', next: 1 });
	});

	it('辞書の __proto__ キーを通常のプロパティとして保持する', () => {
		const parsed = parseStructuredData("{'__proto__': {'a': 1}}");
		expect(JSON.stringify(parsed)).toBe('{"__proto__":{"a":1}}');
	});

	it('JSONの __class__ キーをデータとして扱う', () => {
		const parsed = parseStructuredData('{"__class__":"literal"}');
		expect(isPythonObject(parsed)).toBe(false);
		expect(parsed).toEqual({ __class__: 'literal' });
	});

	it.each([
		'hello world',
		'{"a":}',
		'ModelResponse(created=)',
		'A(value=[1,,2])',
		'A(value=1=)',
		"{'key': 1:}",
		"A(text='x, y)"
	])('無効な入力 %s を拒否する', (input) =>
		expect(() => parseStructuredData(input)).toThrow('解析エラー')
	);
});
