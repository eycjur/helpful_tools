<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import JsonViewer from './JsonViewer.svelte';

	import { parseStructuredData, type DataValue } from './structured-data';

	let inputJson = '';
	let outputJson = '';
	let errorMessage = '';
	let isValid = false;
	let parsedData: DataValue = null;

	const tool = tools.find((t) => t.name === 'json-formatter');

	function parseInput(input: string) {
		errorMessage = '';
		outputJson = '';
		isValid = false;
		parsedData = null;

		if (!input.trim()) return;

		const MAX_INPUT_SIZE = 1_048_576; // 1MB
		if (input.length > MAX_INPUT_SIZE) {
			errorMessage = '入力サイズが大きすぎます（最大: 1.0MB）';
			return;
		}

		try {
			parsedData = parseStructuredData(input);
			outputJson = JSON.stringify(parsedData, null, 2);
			isValid = true;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'データを解析できませんでした';
		}
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
		if (isValid) copyToClipboard(outputJson);
	}

	$: parseInput(inputJson);
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
			<p class="mt-2 text-xs text-gray-600">
				Python表記は辞書・リスト・クラス表現と、文字列・数値・True/False・Noneに対応します。
				数値は、出力時に桁が失われたり範囲を超えたりする場合にエラーになります。
			</p>
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
			{:else if isValid}
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
