<script lang="ts">
	import { tools } from '$lib/data/tools';
	let text = '';

	const tool = tools.find((t) => t.name === 'character-counter');
</script>

<div class="mx-auto max-w-2xl">
	<div class="mb-6 flex items-center">
		<span class="mr-4 text-4xl">{tool?.icon}</span>
		<h1 class="text-3xl font-bold">{tool?.name}</h1>
	</div>
	<textarea
		bind:value={text}
		rows="6"
		placeholder="テキストを入力してください"
		class="mb-4 w-full resize-none rounded-lg border border-gray-300 p-3"
	></textarea>
	<p class="text-lg font-semibold text-gray-700">文字数: {text.length}</p>
</div>
