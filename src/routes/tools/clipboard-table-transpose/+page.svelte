<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { parseTableFromClipboard, transposeTable, tableToTsv } from './table-transpose';

	const tool = tools.find((t) => t.name === 'clipboard-table-transpose');

	let inputText = $state('');
	let outputText = $state('');
	let errorMessage = $state('');
	let isLoading = $state(false);

	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	function applyTranspose(plain: string, html?: string) {
		errorMessage = '';
		const parsed = parseTableFromClipboard(plain, html);
		if (!parsed || parsed.rows.length === 0) {
			outputText = '';
			if (plain.trim()) {
				errorMessage = '表形式のデータを認識できませんでした';
			}
			return;
		}

		const maxCols = Math.max(...parsed.rows.map((r) => r.length), 0);
		if (parsed.rows.length === 1 && maxCols <= 1) {
			errorMessage = '転置するには2行以上、または2列以上の表が必要です';
			outputText = '';
			return;
		}

		outputText = tableToTsv(transposeTable(parsed.rows));
		navigator.clipboard.writeText(outputText).catch((err) => {
			console.error('自動コピーに失敗しました: ', err);
		});
	}

	function handleInput() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => applyTranspose(inputText), 300);
	}

	async function readFromClipboard() {
		if (isLoading) return;
		isLoading = true;
		errorMessage = '';

		try {
			let plain = '';
			let html: string | undefined;

			if (navigator.clipboard.read) {
				const items = await navigator.clipboard.read();
				for (const item of items) {
					if (item.types.includes('text/html')) {
						html = await (await item.getType('text/html')).text();
					}
					if (item.types.includes('text/plain')) {
						plain = await (await item.getType('text/plain')).text();
					}
				}
			} else {
				plain = await navigator.clipboard.readText();
			}

			if (!plain.trim() && !html?.trim()) {
				errorMessage = 'クリップボードに表データがありません';
				return;
			}

			const parsed = parseTableFromClipboard(plain, html);
			if (parsed) {
				inputText = tableToTsv(parsed.rows);
			} else if (plain.trim()) {
				inputText = plain;
			}
			applyTranspose(plain, html);
		} catch (e) {
			errorMessage =
				'クリップボードを読み取れませんでした。貼り付け欄に直接貼り付けるか、権限を確認してください';
			console.error(e);
		} finally {
			isLoading = false;
		}
	}

	function clearAll() {
		clearTimeout(debounceTimer);
		inputText = '';
		outputText = '';
		errorMessage = '';
	}

	function handlePaste(event: ClipboardEvent) {
		const plain = event.clipboardData?.getData('text/plain') ?? '';
		const html = event.clipboardData?.getData('text/html');
		if (html?.includes('<table')) {
			event.preventDefault();
			inputText = plain;
			applyTranspose(plain, html);
		}
	}
</script>

<div class="mx-auto max-w-6xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<div class="mb-4 flex flex-wrap gap-3">
		<button
			type="button"
			onclick={readFromClipboard}
			disabled={isLoading}
			class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
		>
			<Icon icon="mdi:clipboard-arrow-down" class="mr-2 h-5 w-5" />
			{isLoading ? '読み込み中...' : 'クリップボードから読み込んで転置'}
		</button>
		<button
			type="button"
			onclick={clearAll}
			class="rounded-lg bg-gray-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-600"
		>
			クリア
		</button>
	</div>

	{#if errorMessage}
		<p class="mb-4 text-sm text-red-600" role="alert">{errorMessage}</p>
	{/if}

	<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
		<div class="flex flex-col">
			<div class="mb-2 text-sm font-medium text-gray-700">【入力】表データ</div>
			<textarea
				bind:value={inputText}
				oninput={handleInput}
				onpaste={handlePaste}
				placeholder="Excel やスプレッドシートからコピーした表を貼り付け..."
				class="min-h-96 flex-1 resize-none rounded-lg border border-gray-300 bg-white p-3 font-mono text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
			></textarea>
		</div>

		<div class="flex flex-col">
			<div class="mb-2 text-sm font-medium text-gray-700">【出力】転置結果（自動コピー）</div>
			<textarea
				readonly
				value={outputText}
				placeholder="転置結果がここに表示されます"
				class="min-h-96 flex-1 resize-none rounded-lg border border-gray-300 bg-gray-50 p-3 font-mono text-sm"
			></textarea>
		</div>
	</div>
</div>
