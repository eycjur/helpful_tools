<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	let text = '';

	const tool = tools.find((t) => t.name === 'character-counter');

	// グラフェム数（見た目の文字数）をカウント
	// Intl.Segmenterを使用して絵文字等も正しくカウント
	function countGraphemes(str: string): number {
		if (!str) return 0;
		const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });
		return [...segmenter.segment(str)].length;
	}

	// バイト数をカウント（UTF-8）
	function countBytes(str: string): number {
		return new TextEncoder().encode(str).length;
	}

	// 行数をカウント
	function countLines(str: string): number {
		if (!str) return 0;
		return str.split('\n').length;
	}

	// リアクティブな計算
	$: graphemeCount = countGraphemes(text);
	$: codeUnitCount = text.length; // UTF-16コードユニット数
	$: byteCount = countBytes(text);
	$: lineCount = countLines(text);
</script>

<div class="mx-auto max-w-2xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>
	<textarea
		bind:value={text}
		rows="6"
		placeholder="テキストを入力してください"
		class="mb-4 w-full resize-none rounded-lg border border-gray-300 p-3"
	></textarea>

	<div class="space-y-3">
		<!-- メイン表示：見た目の文字数 -->
		<p class="text-lg font-semibold text-gray-700">
			文字数: <span class="text-blue-600">{graphemeCount.toLocaleString()}</span>
		</p>

		<!-- 詳細情報 -->
		<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
			<h3 class="mb-2 text-sm font-medium text-gray-600">詳細情報</h3>
			<div class="grid grid-cols-2 gap-2 text-sm text-gray-700">
				<div>
					<span class="text-gray-500">コードユニット数:</span>
					{codeUnitCount.toLocaleString()}
				</div>
				<div>
					<span class="text-gray-500">バイト数 (UTF-8):</span>
					{byteCount.toLocaleString()}
				</div>
				<div>
					<span class="text-gray-500">行数:</span>
					{lineCount.toLocaleString()}
				</div>
			</div>
		</div>

		<!-- 注意書き -->
		{#if graphemeCount !== codeUnitCount}
			<p class="text-xs text-gray-500">
				※ 絵文字や結合文字を含むため、コードユニット数と異なります
			</p>
		{/if}
	</div>
</div>
