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

	it('辞書やクラスの値をJSONに変換しても内容を保持する', () => {
		const data = parseStructuredData(
			"ModelResponse(text='9007199254740993', values=[None, True, -0.125, 1e100, 42])"
		);
		expect(parseStructuredData(JSON.stringify(data))).toEqual({
			__class__: 'ModelResponse',
			text: '9007199254740993',
			values: [null, true, -0.125, 1e100, 42]
		});
	});

	it.each(['1.000e3', '1e100', '9007199254740992', '{"text":"\\"1e400\\""}'])(
		'表記の正規化や文字列の数値 %s を許可する',
		(input) => expect(parseStructuredData(input)).toEqual(JSON.parse(input))
	);

	it.each([
		'9007199254740993',
		'{"list": [0.1234567890123456789]}',
		'1e-400',
		'A(id=9007199254740993)'
	])('桁が失われる数値 %s を拒否する', (input) => {
		expect(() => parseStructuredData(input)).toThrow('数値の精度を保持できません');
	});

	it.each(['{"n":1e400}', 'A(n=1e400)'])('範囲外の数値 %s を拒否する', (input) => {
		expect(() => parseStructuredData(input)).toThrow('数値が扱える範囲を超えています');
	});

	it('Pythonクラス名と衝突する引数名を知らせる', () => {
		expect(() => parseStructuredData("A(__class__='ユーザー入力')")).toThrow(
			'引数名の「__class__」はJSON出力でクラス名に使われます'
		);
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
