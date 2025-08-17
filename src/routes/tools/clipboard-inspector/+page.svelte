<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';

	const tool = tools.find((t) => t.name === 'clipboard-inspector');

	let clipboardData: { type: string; content: string; error?: boolean }[] = [];
	let isLoading = false;
	let hasRead = false;

	async function readClipboard() {
		if (isLoading) return;

		isLoading = true;
		hasRead = false;
		clipboardData = [];

		try {
			const items = await navigator.clipboard.read();

			for (const item of items) {
				for (const type of item.types) {
					try {
						const blob = await item.getType(type);
						const content = await blob.text();
						clipboardData.push({ type, content });
					} catch {
						clipboardData.push({ type, content: '(binary or unreadable)', error: true });
					}
				}
			}

			hasRead = true;
		} catch (e) {
			clipboardData = [{ type: 'error', content: 'Failed: ' + (e as Error).message, error: true }];
			hasRead = true;
		} finally {
			isLoading = false;
		}
	}

	function clearOutput() {
		clipboardData = [];
		hasRead = false;
	}

	function copyToClipboard(content: string) {
		if (content.trim()) {
			navigator.clipboard.writeText(content).catch((err) => {
				console.error('コピーに失敗しました: ', err);
			});
		}
	}
</script>

<div class="mx-auto max-w-6xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<div class="mb-6 flex flex-wrap gap-4">
		<button
			on:click={readClipboard}
			disabled={isLoading}
			class="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:bg-blue-400"
		>
			{#if isLoading}
				<div
					class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
				></div>
				読み取り中...
			{:else}
				<Icon icon="mdi:clipboard-text" class="h-4 w-4" />
				クリップボードを読み取る
			{/if}
		</button>

		{#if hasRead}
			<button
				on:click={clearOutput}
				class="rounded-lg bg-gray-500 px-4 py-2 text-white transition-colors hover:bg-gray-600"
			>
				クリア
			</button>
		{/if}
	</div>

	{#if hasRead && clipboardData.length > 0}
		<div class="mb-6 grid grid-cols-2 gap-6">
			{#each clipboardData as data (data.type)}
				<div class="rounded-lg border border-gray-300 p-4">
					<div class="mb-3 flex items-center justify-between">
						<h3 class="text-lg font-semibold text-gray-800">{data.type}</h3>
						{#if !data.error}
							<button
								on:click={() => copyToClipboard(data.content)}
								class="flex items-center gap-1 rounded bg-blue-600 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-700"
							>
								<Icon icon="mdi:content-copy" class="h-3 w-3" />
								コピー
							</button>
						{/if}
					</div>
					<textarea
						value={data.content}
						readonly
						class="h-96 w-full resize-y rounded border border-gray-200 bg-gray-50 p-3 font-mono text-sm"
						class:text-red-600={data.error}
					></textarea>
				</div>
			{/each}
		</div>
	{:else}
		<div class="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
			<Icon icon="mdi:clipboard-outline" class="mx-auto mb-4 h-16 w-16 text-gray-400" />
			<p class="text-lg text-gray-600">「クリップボードを読み取る」ボタンをクリックしてください</p>
			<p class="mt-2 text-sm text-gray-500">
				クリップボードの内容（HTML、プレーンテキスト、その他のMIMEタイプ）を詳細に表示します
			</p>
		</div>
	{/if}
</div>
