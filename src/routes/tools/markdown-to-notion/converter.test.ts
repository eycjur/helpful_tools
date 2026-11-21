import { describe, it, expect } from 'vitest';
import { markdownToNotion } from './converter';

describe('Markdown → Notion変換', () => {
	it('単純なテキストの改行を2倍にする', () => {
		const input = 'Line 1\nLine 2\nLine 3';
		const expected = 'Line 1\n\nLine 2\n\nLine 3';
		expect(markdownToNotion(input)).toBe(expected);
	});

	it('コードブロック内の改行は保持する', () => {
		const input = 'Text\n```\ncode\nblock\n```\nText';
		const expected = 'Text\n\n```\ncode\nblock\n```\n\nText';
		expect(markdownToNotion(input)).toBe(expected);
	});

	it('インラインコード内の改行は保持する', () => {
		const input = 'Text `code` more';
		// インラインコードには改行がないが、外側の改行は2倍になる
		expect(markdownToNotion(input)).toBe('Text `code` more');
	});

	it('複数のコードブロックを正しく処理する', () => {
		const input = '```js\ncode1\n```\nText\n```py\ncode2\n```';
		const expected = '```js\ncode1\n```\n\nText\n\n```py\ncode2\n```';
		expect(markdownToNotion(input)).toBe(expected);
	});

	it('空文字列を処理する', () => {
		expect(markdownToNotion('')).toBe('');
	});

	it('入力にプレースホルダー文字列が含まれても壊れない', () => {
		const input = 'Text __CODE_BLOCK__0__\n```\ncode\n```';
		const expected = 'Text __CODE_BLOCK__0__\n\n```\ncode\n```';
		expect(markdownToNotion(input)).toBe(expected);
	});

	it('コード内のドル記号をそのまま保持する', () => {
		const code = '```sh\necho "$& $$ $\'"\n```';
		expect(markdownToNotion(`前\n${code}\n後`)).toBe(`前\n\n${code}\n\n後`);
	});

	it('CRLFを分割せずに改行を2倍にする', () => {
		expect(markdownToNotion('前\r\n`a\r\nb`\r\n後')).toBe('前\r\n\r\n`a\r\nb`\r\n\r\n後');
	});

	it('コードフェンスの中にある短いバッククォート列で閉じない', () => {
		const code = '````md\n```js\ncode\n```\n`````';
		expect(markdownToNotion('前\n' + code + '\n後')).toBe('前\n\n' + code + '\n\n後');
	});

	it.each([
		['引用', '> ', '> '],
		['入れ子の引用', '> > ', '> > '],
		['リストと同じ行から開始', '1.  ', '    '],
		['リスト内の4空白インデント', '    ', '    ']
	])('%sのコードと後続本文の改行を区別する', (_kind, openingPrefix, bodyPrefix) => {
		const code = [
			openingPrefix + '````md',
			bodyPrefix + '```js',
			bodyPrefix + 'code',
			bodyPrefix + '```',
			bodyPrefix + '`````'
		].join('\n');
		expect(markdownToNotion('前\n' + code + '\n後\n本文')).toBe('前\n\n' + code + '\n\n後\n\n本文');
	});

	it('引用内で閉じていないフェンスは引用が終わるところまで保持する', () => {
		const code = '> ```js\n> code\n> more';
		expect(markdownToNotion(code + '\n後\n本文')).toBe(code + '\n\n後\n\n本文');
	});

	it('チルダのコードフェンスと数式ブロック内の改行を保持する', () => {
		const code = '~~~tex\r\n$$\r\nx = 1\r\n$$\r\n~~~';
		const equation = '$$\r\n\\begin{aligned}\r\nx &= 1 \\\\\r\ny &= 2\r\n\\end{aligned}\r\n$$';
		expect(markdownToNotion(code + '\r\n' + equation + '\r\n後')).toBe(
			code + '\r\n\r\n' + equation + '\r\n\r\n後'
		);
	});

	it('数式ブロックの閉じ忘れや本文のドル記号では通常の改行を変換する', () => {
		expect(markdownToNotion('価格は $5\n$$\n後')).toBe('価格は $5\n\n$$\n\n後');
	});

	it('インラインコードの開始と終了でバッククォートの本数をそろえる', () => {
		const code = '``a `b`\nc``';
		expect(markdownToNotion('前 ' + code + '\n後')).toBe('前 ' + code + '\n\n後');
	});

	it('エスケープされたバッククォートをインラインコードの開始とみなさない', () => {
		expect(markdownToNotion('前 \\`\n後`')).toBe('前 \\`\n\n後`');
	});

	it('閉じていないコードフェンスは入力の末尾まで保持する', () => {
		const code = '```js\nconst x = `a`;\n';
		expect(markdownToNotion('前\n' + code)).toBe('前\n\n' + code);
	});
});
