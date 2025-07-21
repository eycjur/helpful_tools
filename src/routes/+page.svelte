<script lang="ts">
	import { tools } from '$lib/data/tools';
	import { base } from '$app/paths';
	import Icon from '@iconify/svelte';
	import { onMount } from 'svelte';

	let searchQuery = '';
	let searchInput: HTMLInputElement;

	// 検索フィルタリング機能
	$: filteredTools = tools.filter(
		(tool) =>
			tool.nameJa.toLowerCase().includes(searchQuery.toLowerCase()) ||
			tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
			tool.name.toLowerCase().includes(searchQuery.toLowerCase())
	);

	onMount(() => {
		function handleKeydown(event: KeyboardEvent) {
			// '/'キーが押されたとき、検索入力にフォーカスしてデフォルトの動作を防ぐ
			if (event.key === '/' && event.target !== searchInput) {
				event.preventDefault();
				searchInput?.focus();
			}
		}

		window.addEventListener('keydown', handleKeydown);

		return () => {
			window.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

<svelte:head>
	<title>Home</title>
	<meta name="description" content="Svelte demo app" />
</svelte:head>

<section class="mx-auto max-w-4xl">
	<h1 class="mb-8 text-center text-3xl font-bold">便利ツール一覧</h1>

	<!-- 検索窓 -->
	<div class="mb-8">
		<div class="relative">
			<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
				<Icon icon="mdi:magnify" class="h-5 w-5 text-gray-400" />
			</div>
			<input
				type="text"
				bind:this={searchInput}
				bind:value={searchQuery}
				placeholder="ツールを検索... (/ でフォーカス)"
				class="w-full rounded-lg border border-gray-300 bg-white py-3 pr-4 pl-10 text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
			/>
			{#if searchQuery}
				<button
					type="button"
					on:click={() => (searchQuery = '')}
					class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
					aria-label="検索をクリア"
				>
					<Icon icon="mdi:close" class="h-5 w-5" />
				</button>
			{/if}
		</div>

		<!-- 検索結果件数表示 -->
		{#if searchQuery}
			<p class="mt-2 text-sm text-gray-600">
				{filteredTools.length}件のツールが見つかりました
			</p>
		{/if}
	</div>

	<!-- ツール一覧 -->
	{#if filteredTools.length > 0}
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
			{#each filteredTools as tool (tool.name)}
				<a
					href="{base}/tools/{tool.name}"
					class="block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow duration-200 hover:border-blue-300 hover:shadow-md"
				>
					<div class="mb-3 flex items-center">
						<Icon icon={tool.icon} class="mr-3 h-8 w-8" />
						<h2 class="text-xl font-semibold text-gray-800">{tool.nameJa}</h2>
					</div>
					<p class="text-gray-600">{tool.description}</p>
				</a>
			{/each}
		</div>
	{:else}
		<!-- 検索結果が0件の場合 -->
		<div class="py-12 text-center">
			<Icon icon="mdi:magnify" class="mx-auto mb-4 h-12 w-12 text-gray-400" />
			<h3 class="mb-2 text-lg font-medium text-gray-900">該当するツールが見つかりません</h3>
			<p class="text-gray-500">
				「{searchQuery}」に一致するツールがありません。<br />
				検索キーワードを変更してお試しください。
			</p>
			<button
				type="button"
				on:click={() => (searchQuery = '')}
				class="mt-4 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
			>
				<Icon icon="mdi:refresh" class="mr-2 h-4 w-4" />
				全てのツールを表示
			</button>
		</div>
	{/if}
</section>
