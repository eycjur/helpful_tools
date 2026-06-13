<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { copyMarkdownToSlackClipboard, markdownToSlack } from './converter';

	let markdownInput = $state('');
	let previewMarkdown = $state('');

	const tool = tools.find((t) => t.name === 'markdown-to-slack');

	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	function convertAndCopy() {
		const result = markdownToSlack(markdownInput);
		if (!result) {
			previewMarkdown = '';
			return;
		}

		previewMarkdown = result.previewMarkdown;

		const ok = copyMarkdownToSlackClipboard(markdownInput, result.deltaJson);
		if (!ok) {
			console.error('自動コピーに失敗しました');
		}
	}

	function handleInput() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(convertAndCopy, 300);
	}

	function clearInput() {
		clearTimeout(debounceTimer);
		markdownInput = '';
		previewMarkdown = '';
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
			clearTimeout(debounceTimer);
			convertAndCopy();
		}
	}
</script>

<div class="mx-auto max-w-6xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<div class="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
		<!-- 入力 -->
		<div class="flex flex-col">
			<div class="mb-2 flex items-center justify-between">
				<div class="text-sm font-medium text-gray-700">【入力】Markdown</div>
				<button
					type="button"
					onclick={clearInput}
					class="rounded bg-gray-500 px-3 py-1 text-sm text-white transition-colors hover:bg-gray-600"
				>
					クリア
				</button>
			</div>
			<textarea
				bind:value={markdownInput}
				oninput={handleInput}
				onkeydown={handleKeydown}
				placeholder="Markdownを入力してください..."
				class="min-h-96 flex-1 resize-none rounded-lg border border-gray-300 bg-white p-3 font-mono text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
			></textarea>
		</div>

		<!-- プレビュー -->
		<div class="flex flex-col">
			<div class="mb-2">
				<div class="text-sm font-medium text-gray-700">
					【出力】Slack向けリッチテキスト（自動コピー）
				</div>
			</div>
			<pre
				class="min-h-96 flex-1 overflow-auto rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm whitespace-pre-wrap">{previewMarkdown}</pre>
		</div>
	</div>

	<div class="mt-6 rounded-lg bg-yellow-50 p-4">
		<h2 class="mb-2 text-lg font-semibold">対応している主な記法</h2>
		<ul class="space-y-1 text-sm text-gray-700">
			<li>• 太字・斜体・取り消し線・インラインコード・コードブロック</li>
			<li>• リンク、箇条書き、番号付きリスト、引用、見出し</li>
			<li>• クリップボードは Slack が認識する形式（slack/texty）で書き込みます</li>
		</ul>
	</div>
</div>
