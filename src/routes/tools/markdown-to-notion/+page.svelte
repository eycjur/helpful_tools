<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';

	let markdownInput = '';
	let notionOutput = '';

	const tool = tools.find((t) => t.name === 'markdown-to-notion');

	function markdownToNotion(input: string): string {
		let output: string = input;

		// コードブロック内の改行は保持し、それ以外の改行を2つの改行に置換
		const codeBlockRegex = /```[\s\S]*?```|`[^`]*`/g;
		const codeBlocks: string[] = [];

		// コードブロックを一時的に保存
		output = output.replace(codeBlockRegex, (match) => {
			codeBlocks.push(match);
			return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
		});

		// コードブロック以外の改行を2つの改行に置換
		output = output.replace(/\n/g, '\n\n');

		// コードブロックを復元
		codeBlocks.forEach((codeBlock, index) => {
			output = output.replace(`__CODE_BLOCK_${index}__`, codeBlock);
		});

		return output;
	}

	function convertToNotion() {
		if (!markdownInput.trim()) {
			notionOutput = '';
			return;
		}

		const convertedText = markdownToNotion(markdownInput);
		notionOutput = convertedText;

		// 自動コピー
		if (convertedText.trim()) {
			navigator.clipboard.writeText(convertedText).catch((err) => {
				console.error('自動コピーに失敗しました: ', err);
			});
		}
	}

	function handleInput() {
		convertToNotion();
	}

	function clearInput() {
		markdownInput = '';
		notionOutput = '';
	}

	function handleKeydown(event: KeyboardEvent) {
		// Ctrl+Enterで変換実行
		if (event.key === 'Enter' && event.ctrlKey) {
			convertToNotion();
		}
	}
</script>

<div class="mx-auto max-w-6xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<div class="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
		<!-- 入力エリア -->
		<div class="flex flex-col">
			<div class="mb-2 flex items-center justify-between">
				<div class="text-sm font-medium text-gray-700">【入力】Markdownテキスト</div>
				<button
					on:click={clearInput}
					class="rounded bg-gray-500 px-3 py-1 text-sm text-white transition-colors hover:bg-gray-600"
				>
					クリア
				</button>
			</div>
			<textarea
				bind:value={markdownInput}
				on:input={handleInput}
				on:keydown={handleKeydown}
				placeholder="Markdownテキストを入力してください..."
				class="min-h-96 flex-1 resize-none rounded-lg border border-gray-300 bg-white p-3 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
			></textarea>
		</div>

		<!-- 出力エリア -->
		<div class="flex flex-col">
			<div class="mb-2">
				<div class="text-sm font-medium text-gray-700">【出力】Notion形式（自動コピー）</div>
			</div>
			<pre
				class="min-h-96 flex-1 overflow-auto rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm whitespace-pre-wrap">{notionOutput}</pre>
		</div>
	</div>

	<!-- 使用方法 -->
	<div class="mt-8 rounded-lg bg-blue-50 p-4">
		<h2 class="mb-2 text-lg font-semibold">使用方法</h2>
		<ul class="space-y-1 text-sm text-gray-700">
			<li>• 左側のテキストエリアにMarkdownテキストを入力してください</li>
			<li>• 自動的にNotion形式に変換されて右側に表示されます</li>
			<li>• 変換されたテキストは自動的にクリップボードにコピーされます</li>
			<li>• Ctrl+Enterキーでも変換を実行できます</li>
			<li>• 「クリア」ボタンで入力エリアを空にできます</li>
		</ul>
	</div>

	<!-- 変換仕様 -->
	<div class="mt-6 rounded-lg bg-yellow-50 p-4">
		<h2 class="mb-2 text-lg font-semibold">変換仕様</h2>
		<ul class="space-y-1 text-sm text-gray-700">
			<li>• 改行が2つの改行に変換されます（段落区切りがより明確になります）</li>
			<li>• コードブロック（```または`で囲まれた部分）内の改行は保持されます</li>
			<li>• NotionではMarkdown形式の一部記法がそのまま利用できます</li>
		</ul>
	</div>
</div>
