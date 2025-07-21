<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	let text = '';

	const tool = tools.find((t) => t.name === 'character-counter');
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
	<p class="text-lg font-semibold text-gray-700">文字数: {text.length}</p>
</div>
