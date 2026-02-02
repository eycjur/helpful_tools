<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import JsonViewer from './JsonViewer.svelte';

	// JSON値の型定義
	type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
	type JsonObject = { [key: string]: JsonValue };
	type JsonArray = JsonValue[];

	// Pythonオブジェクトの型定義
	type PythonObject = { __class__: string; [key: string]: JsonValue };

	// 全体のデータ型
	type DataValue = JsonValue | PythonObject;

	let inputJson = '';
	let outputJson = '';
	let errorMessage = '';
	const indentSize = 2; // 固定値
	let isValid = false;
	let parsedData: DataValue | null = null;

	const tool = tools.find((t) => t.name === 'json-formatter');

	function parseJsonInput() {
		errorMessage = '';
		isValid = false;
		parsedData = null;

		if (!inputJson.trim()) {
			outputJson = '';
			return;
		}

		// 入力サイズ制限（1MB）
		const MAX_INPUT_SIZE = 1_048_576; // 1MB
		if (inputJson.length > MAX_INPUT_SIZE) {
			errorMessage = `入力サイズが大きすぎます（最大: ${(MAX_INPUT_SIZE / 1024 / 1024).toFixed(1)}MB）`;
			isValid = false;
			outputJson = '';
			return;
		}

		// まずJSON形式として解析を試行
		try {
			parsedData = JSON.parse(inputJson);
			isValid = true;
			return;
		} catch (jsonError) {
			// JSON解析に失敗した場合、Pythonオブジェクト形式として解析を試行
			try {
				parsedData = parsePythonObject(inputJson.trim());
				isValid = true;
				return;
			} catch (pythonError) {
				errorMessage = `解析エラー: JSONでもPythonオブジェクトでもありません\n\nJSON: ${jsonError instanceof Error ? jsonError.message : '不明なエラー'}\nPython: ${pythonError instanceof Error ? pythonError.message : '不明なエラー'}`;
				isValid = false;
				outputJson = '';
			}
		}
	}

	function parsePythonObject(text: string, depth = 0): DataValue {
		// 再帰深度制限（無限再帰防止）
		const MAX_DEPTH = 100;
		if (depth > MAX_DEPTH) {
			throw new Error('オブジェクトが深すぎます（最大深度: 100）');
		}

		// Pythonオブジェクト形式のパーサー
		text = text.trim();

		// None, True, False の置換
		text = text.replace(/\bNone\b/g, 'null');
		text = text.replace(/\bTrue\b/g, 'true');
		text = text.replace(/\bFalse\b/g, 'false');

		// 関数呼び出し形式 ClassName(...) を検出
		const functionMatch = text.match(/^(\w+)\((.*)\)$/s);
		if (functionMatch) {
			const className = functionMatch[1];
			const args = functionMatch[2];

			return {
				__class__: className,
				...parseArguments(args, depth)
			};
		}

		// リスト形式
		if (text.startsWith('[') && text.endsWith(']')) {
			return parseList(text, depth);
		}

		// 辞書形式
		if (text.startsWith('{') && text.endsWith('}')) {
			return parseDict(text, depth);
		}

		// 文字列
		if (
			(text.startsWith("'") && text.endsWith("'")) ||
			(text.startsWith('"') && text.endsWith('"'))
		) {
			return text.slice(1, -1);
		}

		// 数値
		const num = Number(text);
		if (!isNaN(num)) {
			return num;
		}

		// boolean/null
		if (text === 'true') return true;
		if (text === 'false') return false;
		if (text === 'null') return null;

		// その他は文字列として扱う
		return text;
	}

	function parseArguments(argsStr: string, depth = 0): JsonObject {
		const result: JsonObject = {};

		if (!argsStr.trim()) return result;

		const args = splitArguments(argsStr);

		for (const arg of args) {
			const eqIndex = arg.indexOf('=');
			if (eqIndex > 0) {
				const key = arg.substring(0, eqIndex).trim();
				const value = arg.substring(eqIndex + 1).trim();
				result[key] = parsePythonObject(value, depth + 1);
			}
		}

		return result;
	}

	function parseList(text: string, depth = 0): JsonArray {
		const content = text.slice(1, -1).trim();
		if (!content) return [];

		const items = splitArguments(content);
		return items.map((item) => parsePythonObject(item, depth + 1));
	}

	function parseDict(text: string, depth = 0): JsonObject {
		const content = text.slice(1, -1).trim();
		if (!content) return {};

		const result: JsonObject = {};
		const pairs = splitArguments(content);

		for (const pair of pairs) {
			const colonIndex = pair.indexOf(':');
			if (colonIndex > 0) {
				const keyStr = pair.substring(0, colonIndex).trim();
				const key = parsePythonObject(keyStr, depth + 1);
				const value = parsePythonObject(pair.substring(colonIndex + 1).trim(), depth + 1);
				// keyを文字列として扱う
				const keyAsString = typeof key === 'string' ? key : String(key);
				result[keyAsString] = value;
			}
		}

		return result;
	}

	function splitArguments(str: string): string[] {
		const args: string[] = [];
		let current = '';
		let depth = 0;
		let inString = false;
		let stringChar = '';

		for (let i = 0; i < str.length; i++) {
			const char = str[i];
			const prevChar = i > 0 ? str[i - 1] : '';

			if (!inString) {
				if (char === '"' || char === "'") {
					inString = true;
					stringChar = char;
				} else if (char === '(' || char === '[' || char === '{') {
					depth++;
				} else if (char === ')' || char === ']' || char === '}') {
					depth--;
				} else if (char === ',' && depth === 0) {
					args.push(current.trim());
					current = '';
					continue;
				}
			} else if (char === stringChar && prevChar !== '\\') {
				inString = false;
				stringChar = '';
			}

			current += char;
		}

		if (current.trim()) {
			args.push(current.trim());
		}

		return args;
	}

	function copyToClipboard(text: string) {
		// モダンブラウザのClipboard APIを優先使用
		if (navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard.writeText(text).catch((err) => {
				console.error('自動コピーに失敗しました: ', err);
				// フォールバック処理
				fallbackCopyToClipboard(text);
			});
		} else {
			// 古いブラウザ向けのフォールバック
			fallbackCopyToClipboard(text);
		}
	}

	function fallbackCopyToClipboard(text: string) {
		try {
			const textarea = document.createElement('textarea');
			textarea.value = text;
			textarea.style.position = 'fixed';
			textarea.style.opacity = '0';
			document.body.appendChild(textarea);
			textarea.select();
			textarea.setSelectionRange(0, 99999);
			const successful = document.execCommand('copy');
			document.body.removeChild(textarea);

			if (!successful) {
				console.error('フォールバックコピーに失敗しました');
			}
		} catch (err) {
			console.error('クリップボードへのコピーに失敗しました: ', err);
		}
	}

	function copyCurrentOutput() {
		if (parsedData) {
			const jsonString = JSON.stringify(parsedData, null, 2);
			copyToClipboard(jsonString);
		}
	}

	// 入力変更時の自動処理（リアクティブ）
	$: if (inputJson) {
		parseJsonInput();
		if (parsedData) {
			outputJson = JSON.stringify(parsedData, null, indentSize);
		}
	} else {
		outputJson = '';
		errorMessage = '';
		isValid = false;
		parsedData = null;
	}
</script>

<div class="mx-auto max-w-6xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<div class="mb-6 grid gap-6 md:grid-cols-10">
		<!-- 入力エリア（4列分） -->
		<div class="flex flex-col md:col-span-4">
			<div class="mb-2">
				<div class="text-sm font-medium text-gray-700">【入力】JSON / Pythonオブジェクト</div>
			</div>
			<textarea
				bind:value={inputJson}
				rows="20"
				placeholder={'JSON例: {"name": "太郎", "age": 30}\n\nPython例: ModelResponse(id="test", created=1234)'}
				class="flex-1 resize-none rounded-lg border border-gray-300 bg-white p-3 font-mono text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
			></textarea>
		</div>

		<!-- 出力エリア（6列分） -->
		<div class="flex flex-col md:col-span-6">
			<div class="mb-2 flex items-center justify-between">
				<div class="text-sm font-medium text-gray-700">【出力】構造化ツリービュー</div>
				{#if isValid}
					<!-- コピーボタン -->
					<button
						on:click={copyCurrentOutput}
						class="rounded bg-green-500 px-3 py-1 text-sm text-white transition-colors hover:bg-green-600"
					>
						<Icon icon="mdi:content-copy" class="mr-1 inline-block h-4 w-4" />
						コピー
					</button>
				{/if}
			</div>
			{#if errorMessage}
				<div class="flex-1 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
					{errorMessage}
				</div>
			{:else if parsedData}
				<div class="flex-1 overflow-auto rounded-lg border border-gray-300 bg-gray-50 p-3">
					<JsonViewer data={parsedData} path="data" maxDepth={50} />
				</div>
			{:else}
				<div class="flex-1 rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm text-gray-500">
					JSON または Python オブジェクトを入力してください
				</div>
			{/if}
		</div>
	</div>

	<!-- ステータス表示 -->
	{#if inputJson}
		<div class="mb-6 rounded-lg bg-blue-50 p-4">
			<div class="flex items-center gap-4 text-sm">
				<span class="font-medium">ステータス:</span>
				{#if isValid}
					<span class="flex items-center text-green-600">
						<Icon icon="mdi:check-circle" class="mr-1 h-4 w-4" />
						解析成功
					</span>
				{:else if errorMessage}
					<span class="flex items-center text-red-600">
						<Icon icon="mdi:alert-circle" class="mr-1 h-4 w-4" />
						解析失敗
					</span>
				{/if}

				{#if outputJson}
					<span class="text-gray-600">
						文字数: {outputJson.length}
					</span>
				{/if}
			</div>
		</div>
	{/if}
</div>
