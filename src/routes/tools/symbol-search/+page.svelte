<script lang="ts">
	import { tools } from '$lib/data/tools';
	import Icon from '@iconify/svelte';
	import { fly } from 'svelte/transition';
	import { symbols } from './symbols';

	const tool = tools.find((t) => t.name === 'symbol-search');

	let searchQuery = $state('');
	let copiedSymbol = $state<string | null>(null);
	let copyTimeout: ReturnType<typeof setTimeout> | null = null;

	// 検索フィルタ（ひらがな・カタカナ・漢字・記号で検索）
	function filterSymbols(query: string) {
		const q = query.trim().toLowerCase();
		if (!q) return symbols;

		const normalizedQuery = q.replace(/ー/g, '').replace(/\u3000/g, ' ');
		const queryChars = normalizedQuery.split(/\s+/).filter(Boolean);

		return symbols.filter((entry) => {
			const searchTarget = [entry.name, entry.symbol, ...entry.keywords]
				.join(' ')
				.toLowerCase()
				.replace(/ー/g, '');

			return queryChars.every((char) => searchTarget.includes(char));
		});
	}

	let filteredSymbols = $derived(filterSymbols(searchQuery));

	async function copySymbol(symbol: string) {
		try {
			await navigator.clipboard.writeText(symbol);
			copiedSymbol = symbol;
			if (copyTimeout) clearTimeout(copyTimeout);
			copyTimeout = setTimeout(() => {
				copiedSymbol = null;
				copyTimeout = null;
			}, 1500);
		} catch (err) {
			console.error('コピーに失敗しました:', err);
		}
	}
</script>

{#if copiedSymbol}
	<div
		class="fixed top-16 right-4 z-50 flex max-w-[min(calc(100vw-2rem),20rem)] items-center gap-2 rounded-lg border border-green-200 bg-white px-4 py-3 shadow-lg lg:top-4"
		role="status"
		aria-live="polite"
		in:fly={{ y: -10, duration: 200 }}
		out:fly={{ y: -8, duration: 150 }}
	>
		<Icon icon="mdi:check-circle" class="h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
		<p class="text-sm text-gray-800">
			<span class="mr-1 font-mono text-lg leading-none">{copiedSymbol}</span>
			<span class="text-gray-600">をコピーしました</span>
		</p>
	</div>
{/if}

<div class="mx-auto max-w-4xl">
	<div class="mb-6 flex items-center">
		{#if tool?.icon}<Icon icon={tool.icon} class="mr-4 h-10 w-10" />{/if}
		<h1 class="text-3xl font-bold">{tool?.nameJa}</h1>
	</div>

	<!-- 検索ボックス -->
	<div class="mb-6">
		<label for="symbol-search" class="mb-2 block text-sm font-medium text-gray-700">
			記号を検索（例: いこーる、ノットイコール、矢印、やじるし）
		</label>
		<input
			id="symbol-search"
			type="text"
			bind:value={searchQuery}
			placeholder="検索ワードを入力..."
			class="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		/>
	</div>

	<!-- 検索結果 -->
	<div class="rounded-lg border border-gray-200 bg-white">
		{#if filteredSymbols.length > 0}
			<div class="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
				{#each filteredSymbols as entry (entry.symbol + entry.name)}
					<button
						type="button"
						onclick={() => copySymbol(entry.symbol)}
						class="flex flex-col items-center justify-center rounded-lg border border-gray-200 p-4 transition-colors hover:border-blue-400 hover:bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
						title="{entry.name} - クリックでコピー"
					>
						<span class="mb-1 text-3xl font-medium" aria-hidden="true">
							{entry.symbol}
						</span>
						<span class="line-clamp-2 text-center text-xs text-gray-600">
							{entry.name}
						</span>
					</button>
				{/each}
			</div>
		{:else}
			<div class="p-8 text-center text-gray-500">
				{#if searchQuery.trim()}
					該当する記号が見つかりませんでした。別のキーワードで検索してみてください。
				{:else}
					上記の検索ボックスにキーワードを入力してください。
					<br />
					<span class="text-sm"
						>例: いこーる、ノットイコール、ニアリイコール、矢印、プラス、ルート</span
					>
				{/if}
			</div>
		{/if}
	</div>

	<!-- 使い方 -->
	<div class="mt-8 rounded-lg bg-blue-50 p-4">
		<h2 class="mb-2 text-lg font-semibold">使い方</h2>
		<ul class="space-y-1 text-sm text-gray-700">
			<li>• 日本語の読み（いこーる、ノットイコールなど）で記号を検索できます</li>
			<li>• 記号をクリックするとクリップボードにコピーされます</li>
			<li>• 複数キーワードで検索する場合はスペースで区切ってください</li>
		</ul>
	</div>
</div>
