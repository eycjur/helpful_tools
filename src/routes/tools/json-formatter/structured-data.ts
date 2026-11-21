type JsonObject = { [key: string]: DataValue };
const PYTHON_CLASS = Symbol('python-class');
export type PythonObject = JsonObject & { __class__: string; [PYTHON_CLASS]: true };
export type DataValue = string | number | boolean | null | JsonObject | DataValue[];

export function isPythonObject(value: DataValue): value is PythonObject {
	return typeof value === 'object' && value !== null && PYTHON_CLASS in value;
}

export function parseStructuredData(input: string): DataValue {
	try {
		return JSON.parse(input);
	} catch (jsonError) {
		try {
			return parsePythonObject(input);
		} catch (pythonError) {
			const jsonMessage = jsonError instanceof Error ? jsonError.message : '不明なエラー';
			const pythonMessage = pythonError instanceof Error ? pythonError.message : '不明なエラー';
			throw new Error(
				`解析エラー: JSONでもPythonオブジェクトでもありません\n\nJSON: ${jsonMessage}\nPython: ${pythonMessage}`
			);
		}
	}
}

const STRING_ESCAPES: Record<string, string> = {
	a: '\u0007',
	b: '\b',
	f: '\f',
	n: '\n',
	r: '\r',
	t: '\t',
	v: '\v',
	"'": "'",
	'"': '"',
	'\\': '\\'
};

function parsePythonObject(input: string, depth = 0): DataValue {
	if (depth > 100) throw new Error('オブジェクトが深すぎます（最大深度: 100）');

	const text = input.trim();
	const call = text.match(/^(\w+)\((.*)\)$/s);
	if (call) {
		const value: PythonObject = {
			__class__: call[1],
			...parsePairList(call[2], '=', depth),
			[PYTHON_CLASS]: true
		};
		return value;
	}

	if (text.startsWith('[') && text.endsWith(']')) {
		return splitTopLevel(text.slice(1, -1), ',').map((item) => parsePythonObject(item, depth + 1));
	}
	if (text.startsWith('{') && text.endsWith('}')) {
		return parsePairList(text.slice(1, -1), ':', depth);
	}

	if (/^(['"])(?:\\[\s\S]|(?!\1)[^\\\r\n])*\1$/.test(text)) {
		return text
			.slice(1, -1)
			.replace(
				/\\(\r?\n|x[\da-fA-F]{2}|u[\da-fA-F]{4}|U[\da-fA-F]{8}|[0-7]{1,3}|.)/gs,
				(match, escaped: string) => {
					if (escaped.endsWith('\n')) return '';
					if (escaped.length > 1 && /^[xuU]/.test(escaped)) {
						return String.fromCodePoint(Number.parseInt(escaped.slice(1), 16));
					}
					if (/^[0-7]/.test(escaped)) return String.fromCodePoint(Number.parseInt(escaped, 8));
					return STRING_ESCAPES[escaped] ?? match;
				}
			);
	}

	if (text === 'None') return null;
	if (text === 'True') return true;
	if (text === 'False') return false;

	if (text) {
		const num = Number(text);
		if (Number.isFinite(num)) return num;
	}

	throw new Error('認識できない値があります');
}

function parsePairList(text: string, separator: ':' | '=', depth: number): JsonObject {
	return Object.fromEntries(
		splitTopLevel(text, ',').map((entry) => {
			const pair = splitTopLevel(entry, separator);
			if (pair.length !== 2 || !pair[0] || !pair[1]) {
				throw new Error(`「${separator}」で区切られた名前と値が必要です`);
			}
			const [key, value] = pair;
			if (separator === '=' && !/^\w+$/.test(key)) {
				throw new Error('引数名の形式が正しくありません');
			}
			return [
				separator === ':' ? String(parsePythonObject(key, depth + 1)) : key,
				parsePythonObject(value, depth + 1)
			];
		})
	);
}

function splitTopLevel(text: string, separator: ',' | ':' | '='): string[] {
	const parts: string[] = [];
	const closingBrackets: string[] = [];
	let start = 0;
	let quote = '';

	for (let index = 0; index < text.length; index++) {
		const char = text[index];
		if (quote) {
			if (char === '\\') index++;
			else if (char === quote) quote = '';
		} else if (char === '"' || char === "'") {
			quote = char;
		} else if (char === '(') {
			closingBrackets.push(')');
		} else if (char === '[') {
			closingBrackets.push(']');
		} else if (char === '{') {
			closingBrackets.push('}');
		} else if (char === ')' || char === ']' || char === '}') {
			if (closingBrackets.pop() !== char) throw new Error('括弧の対応が正しくありません');
		} else if (char === separator && closingBrackets.length === 0) {
			parts.push(text.slice(start, index).trim());
			start = index + 1;
		}
	}

	if (quote || closingBrackets.length) throw new Error('文字列または括弧が閉じていません');

	const tail = text.slice(start).trim();
	if (tail || (separator !== ',' && parts.length)) parts.push(tail);
	return parts;
}
