<script lang="ts">
	import { tools } from '$lib/data/tools';
	import { base } from '$app/paths';
	import Icon from '@iconify/svelte';
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';

	let searchQuery = $state('');
	let searchInput: HTMLInputElement;
	let showDescription = $state(true);

	// 検索フィルタリング機能
	const filteredTools = $derived(
		tools.filter(
			(tool) =>
				tool.nameJa.toLowerCase().includes(searchQuery.toLowerCase()) ||
				tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
				tool.name.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);

	// カテゴリごとにツールをグループ化
	const groupedTools = $derived(searchQuery ? null : groupByCategory(tools));

	function groupByCategory(toolList: typeof tools) {
		const groups = new SvelteMap<string, typeof tools>();
		for (const tool of toolList) {
			if (!groups.has(tool.category)) {
				groups.set(tool.category, []);
			}
			groups.get(tool.category)!.push(tool);
		}
		return groups;
	}

	// カテゴリのアイコンマッピング
	const categoryIcons: Record<string, string> = {
		生成AI: 'mdi:robot',
		'文字・テキスト処理': 'mdi:text-box',
		データ変換: 'mdi:swap-horizontal',
		'画像・メディア': 'mdi:image-multiple',
		PDF操作: 'mdi:file-document-multiple',
		QRコード: 'mdi:qrcode',
		'開発・比較ツール': 'mdi:wrench',
		'ネットワーク・情報': 'mdi:network'
	};

	onMount(() => {
		const saved = localStorage.getItem('helpful_tools_show_description');
		// 未保存時はデフォルト「あり」
		showDescription = saved === 'false' ? false : true;

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

	$effect(() => {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('helpful_tools_show_description', String(showDescription));
		}
	});
</script>

<svelte:head>
	<title>Home</title>
	<meta name="description" content="Svelte demo app" />
</svelte:head>

<section class="mx-auto max-w-7xl">
	<!-- タイトル・検索・説明切替は元の幅感 -->
	<div class="mx-auto max-w-3xl">
		<h1 class="mb-4 text-center text-2xl font-bold">便利ツール一覧</h1>

		<!-- 検索窓 -->
		<div class="mb-4">
			<div class="relative">
				<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
					<Icon icon="mdi:magnify" class="h-4 w-4 text-gray-400" />
				</div>
				<input
					type="text"
					bind:this={searchInput}
					bind:value={searchQuery}
					placeholder="ツールを検索... (/ でフォーカス)"
					class="w-full rounded-lg border border-gray-300 bg-white py-2 pr-3 pl-9 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
				/>
				{#if searchQuery}
					<button
						type="button"
						onclick={() => (searchQuery = '')}
						class="absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-400 hover:text-gray-600"
						aria-label="検索をクリア"
					>
						<Icon icon="mdi:close" class="h-4 w-4" />
					</button>
				{/if}
			</div>

			<!-- 検索結果件数表示・説明表示切替 -->
			<div class="mt-1 flex items-center justify-between gap-2">
				{#if searchQuery}
					<p class="text-xs text-gray-600">
						{filteredTools.length}件のツールが見つかりました
					</p>
				{:else}
					<span></span>
				{/if}
				<label class="flex cursor-pointer items-center gap-1.5 text-xs text-gray-600">
					<input
						type="checkbox"
						bind:checked={showDescription}
						class="h-3 w-3 rounded border-gray-300"
					/>
					説明を表示
				</label>
			</div>
		</div>
	</div>

	<!-- ツール一覧 -->
	{#if searchQuery}
		<!-- 検索結果表示 -->
		{#if filteredTools.length > 0}
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
				{#each filteredTools as tool (tool.name)}
					<a
						href="{base}/tools/{tool.name}"
						class="block rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow duration-200 hover:border-blue-300 hover:shadow-md"
					>
						<div class="{showDescription ? 'mb-1.5' : ''} flex items-center">
							<Icon icon={tool.icon} class="mr-2 h-5 w-5" />
							<h2 class="text-base font-semibold text-gray-800">{tool.nameJa}</h2>
						</div>
						{#if showDescription}
							<p class="text-sm text-gray-600">{tool.description}</p>
						{/if}
					</a>
				{/each}
			</div>
		{:else}
			<!-- 検索結果が0件の場合 -->
			<div class="py-8 text-center">
				<Icon icon="mdi:magnify" class="mx-auto mb-3 h-10 w-10 text-gray-400" />
				<h3 class="mb-1.5 text-base font-medium text-gray-900">該当するツールが見つかりません</h3>
				<p class="text-sm text-gray-500">
					「{searchQuery}」に一致するツールがありません。<br />
					検索キーワードを変更してお試しください。
				</p>
				<button
					type="button"
					onclick={() => (searchQuery = '')}
					class="mt-3 inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
				>
					<Icon icon="mdi:refresh" class="mr-1.5 h-4 w-4" />
					全てのツールを表示
				</button>
			</div>
		{/if}
	{:else}
		<!-- カテゴリ別表示 -->
		{#if groupedTools}
			<div class="space-y-4">
				{#each [...groupedTools.entries()] as [category, categoryTools] (category)}
					<section>
						<div class="mb-2 flex items-center">
							{#if categoryIcons[category]}
								<Icon icon={categoryIcons[category]} class="mr-2 h-5 w-5 text-blue-600" />
							{/if}
							<h2 class="text-base font-semibold text-gray-800">{category}</h2>
						</div>
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
							{#each categoryTools as tool (tool.name)}
								<a
									href="{base}/tools/{tool.name}"
									class="block rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow duration-200 hover:border-blue-300 hover:shadow-md"
								>
									<div class="{showDescription ? 'mb-1' : ''} flex items-center">
										<Icon icon={tool.icon} class="mr-2 h-5 w-5" />
										<h3 class="text-sm font-medium text-gray-800">{tool.nameJa}</h3>
									</div>
									{#if showDescription}
										<p class="text-xs text-gray-600">{tool.description}</p>
									{/if}
								</a>
							{/each}
						</div>
					</section>
				{/each}
			</div>
		{/if}
	{/if}
</section>
