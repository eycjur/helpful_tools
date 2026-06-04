<script lang="ts">
	import { tools } from '$lib/data/tools';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import Icon from '@iconify/svelte';
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';

	let { isOpen = $bindable(false) } = $props();

	type SidebarSize = 'compact' | 'normal' | 'spacious';
	let sidebarSize = $state<SidebarSize>('spacious');
	let searchQuery = $state('');
	let searchInput: HTMLInputElement | undefined;

	const currentPath = $derived($page.url.pathname);

	const filteredTools = $derived(
		tools.filter(
			(tool) =>
				tool.nameJa.toLowerCase().includes(searchQuery.toLowerCase()) ||
				tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
				tool.name.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);

	// カテゴリごとにツールをグループ化（検索時は一致ツールのみ）
	const groupedTools = $derived(
		searchQuery.trim() ? groupByCategory(filteredTools) : groupByCategory(tools)
	);

	const isSearchActive = $derived(searchQuery.trim().length > 0);

	onMount(() => {
		const saved = localStorage.getItem('helpful_tools_sidebar_size');
		if (saved === 'compact' || saved === 'normal' || saved === 'spacious') {
			sidebarSize = saved;
		}

		function handleKeydown(event: KeyboardEvent) {
			const target = event.target;
			if (!(target instanceof HTMLElement)) return;
			if (
				event.key === '/' &&
				!['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) &&
				!target.isContentEditable
			) {
				event.preventDefault();
				searchInput?.focus();
			}
		}

		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});

	$effect(() => {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('helpful_tools_sidebar_size', sidebarSize);
		}
	});

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
</script>

<!-- Overlay -->
{#if isOpen}
	<div
		class="fixed inset-0 z-40 lg:hidden"
		onclick={() => (isOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (isOpen = false)}
		role="button"
		tabindex="0"
		aria-label="サイドバーを閉じる"
	></div>
{/if}

<!-- Sidebar -->
<aside
	class="bg-opacity-95 lg:bg-opacity-100 fixed top-0 left-0 z-50 h-full transform bg-white shadow-lg transition-all duration-300 ease-in-out lg:static lg:translate-x-0 lg:shadow-none {sidebarSize ===
	'compact'
		? 'w-52'
		: sidebarSize === 'normal'
			? 'w-64'
			: 'w-72'} {isOpen ? 'translate-x-0' : '-translate-x-full'}"
>
	<div class="flex h-full flex-col">
		<!-- Header -->
		<div
			class="border-b border-gray-200 {sidebarSize === 'compact'
				? 'p-3'
				: sidebarSize === 'normal'
					? 'p-4'
					: 'p-5'}"
		>
			<div class="flex items-center justify-between">
				<a
					href={base || '/'}
					class="flex items-center font-bold text-blue-600 hover:text-blue-700 {sidebarSize ===
					'compact'
						? 'text-base'
						: sidebarSize === 'normal'
							? 'text-lg'
							: 'text-xl'}"
					onclick={() => (isOpen = false)}
				>
					<Icon
						icon="mdi:tools"
						class={sidebarSize === 'compact'
							? 'mr-1.5 h-5 w-5'
							: sidebarSize === 'normal'
								? 'mr-2 h-6 w-6'
								: 'mr-2 h-7 w-7'}
					/>
					困った時のツール集
				</a>
				<button
					class="rounded p-1 hover:bg-gray-100 lg:hidden"
					onclick={() => (isOpen = false)}
					aria-label="サイドバーを閉じる"
				>
					<Icon icon="mdi:close" class="h-6 w-6" />
				</button>
			</div>

			<!-- ツール検索 -->
			<div
				class={sidebarSize === 'compact' ? 'mt-2' : sidebarSize === 'normal' ? 'mt-3' : 'mt-4'}
			>
				<div class="relative">
					<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
						<Icon
							icon="mdi:magnify"
							class="{sidebarSize === 'compact'
								? 'h-3.5 w-3.5'
								: 'h-4 w-4'} text-gray-400"
						/>
					</div>
					<input
						type="search"
						bind:this={searchInput}
						bind:value={searchQuery}
						placeholder={sidebarSize === 'compact' ? '検索...' : 'ツールを検索... (/ でフォーカス)'}
						aria-label="ツールを検索"
						class="w-full rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none {sidebarSize ===
						'compact'
							? 'py-1 pr-7 pl-7 text-xs'
							: sidebarSize === 'normal'
								? 'py-1.5 pr-8 pl-8 text-xs'
								: 'py-2 pr-9 pl-9 text-sm'}"
					/>
					{#if searchQuery}
						<button
							type="button"
							onclick={() => (searchQuery = '')}
							class="absolute inset-y-0 right-0 flex items-center text-gray-400 hover:text-gray-600 {sidebarSize ===
							'compact'
								? 'pr-1.5'
								: 'pr-2'}"
							aria-label="検索をクリア"
						>
							<Icon
								icon="mdi:close"
								class={sidebarSize === 'compact' ? 'h-3.5 w-3.5' : 'h-4 w-4'}
							/>
						</button>
					{/if}
				</div>
				{#if isSearchActive}
					<p class="mt-1 text-[10px] text-gray-500">
						{filteredTools.length}件
					</p>
				{/if}
			</div>
		</div>

		<!-- Navigation -->
		<nav
			class="flex-1 overflow-y-auto {sidebarSize === 'compact'
				? 'p-3'
				: sidebarSize === 'normal'
					? 'p-4'
					: 'p-5'}"
		>
			<div class="space-y-2">
				<!-- Home -->
				<a
					href={base || '/'}
					class="flex items-center rounded-lg text-gray-700 transition-colors hover:bg-gray-100 {sidebarSize ===
					'compact'
						? 'p-2'
						: sidebarSize === 'normal'
							? 'p-3'
							: 'p-4'} {currentPath === (base || '/') ? 'bg-blue-50 text-blue-700' : ''}"
					onclick={() => (isOpen = false)}
				>
					<Icon
						icon="mdi:home"
						class={sidebarSize === 'compact'
							? 'mr-2 h-4 w-4'
							: sidebarSize === 'normal'
								? 'mr-3 h-5 w-5'
								: 'mr-3 h-6 w-6'}
					/>
					<span
						class="font-medium {sidebarSize === 'compact'
							? 'text-xs'
							: sidebarSize === 'normal'
								? 'text-sm'
								: 'text-base'}"
					>
						ホーム
					</span>
				</a>

				<!-- ツール（カテゴリ別 / 検索時は一致分のみ） -->
				<div
					class={sidebarSize === 'compact'
						? 'mt-3 space-y-1.5'
						: sidebarSize === 'normal'
							? 'mt-4 space-y-2'
							: 'mt-5 space-y-3'}
				>
					{#if isSearchActive && filteredTools.length === 0}
						<p class="px-1 text-xs text-gray-500">
							「{searchQuery}」に一致するツールがありません
						</p>
					{/if}
					{#each [...groupedTools.entries()] as [category, categoryTools] (category)}
						<div>
							<div
								class="flex items-center {sidebarSize === 'compact'
									? 'mb-0.5 px-1'
									: sidebarSize === 'normal'
										? 'mb-1 px-1.5'
										: 'mb-1.5 px-2'}"
							>
								{#if categoryIcons[category]}
									<Icon
										icon={categoryIcons[category]}
										class="text-blue-600 {sidebarSize === 'compact'
											? 'mr-1 h-3 w-3'
											: sidebarSize === 'normal'
												? 'mr-1.5 h-3 w-3'
												: 'mr-2 h-4 w-4'}"
									/>
								{/if}
								<h3
									class="font-semibold tracking-wider text-gray-500 uppercase {sidebarSize ===
									'compact'
										? 'text-[10px]'
										: sidebarSize === 'normal'
											? 'text-[10px]'
											: 'text-xs'}"
								>
									{category}
								</h3>
							</div>
							<div
								class={sidebarSize === 'compact'
									? 'space-y-0'
									: sidebarSize === 'normal'
										? 'space-y-0'
										: 'space-y-0.5'}
							>
								{#each categoryTools as tool (tool.name)}
									{@const toolPath = `${base || ''}/tools/${tool.name}`}
									<a
										href={toolPath}
										class="flex items-center rounded text-gray-700 transition-colors hover:bg-gray-100 {sidebarSize ===
										'compact'
											? 'px-1 py-0.5'
											: sidebarSize === 'normal'
												? 'px-1.5 py-1'
												: 'px-2 py-1.5'} {currentPath === toolPath
											? 'bg-blue-50 text-blue-700'
											: ''}"
										onclick={() => (isOpen = false)}
									>
										<Icon
											icon={tool.icon}
											class="shrink-0 {sidebarSize === 'compact'
												? 'mr-1.5 h-3 w-3'
												: sidebarSize === 'normal'
													? 'mr-2 h-3 w-3'
													: 'mr-2 h-4 w-4'}"
										/>
										<span
											class="truncate {sidebarSize === 'compact'
												? 'text-xs'
												: sidebarSize === 'normal'
													? 'text-xs'
													: 'text-sm'}"
										>
											{tool.nameJa}
										</span>
									</a>
								{/each}
							</div>
						</div>
					{/each}
				</div>
				<!-- サイズ切替（スクロール最下部） -->
				<div
					class="{sidebarSize === 'compact'
						? 'mt-4 pt-3'
						: sidebarSize === 'normal'
							? 'mt-5 pt-4'
							: 'mt-6 pt-5'} flex items-center gap-1 border-t border-gray-200"
				>
					<span class="text-[10px] text-gray-500">表示</span>
					<button
						type="button"
						onclick={() => (sidebarSize = 'compact')}
						class="rounded px-1.5 py-0.5 text-[10px] {sidebarSize === 'compact'
							? 'bg-blue-100 text-blue-700'
							: 'text-gray-500 hover:bg-gray-100'}"
						title="コンパクト"
					>
						小
					</button>
					<button
						type="button"
						onclick={() => (sidebarSize = 'normal')}
						class="rounded px-1.5 py-0.5 text-[10px] {sidebarSize === 'normal'
							? 'bg-blue-100 text-blue-700'
							: 'text-gray-500 hover:bg-gray-100'}"
						title="標準"
					>
						中
					</button>
					<button
						type="button"
						onclick={() => (sidebarSize = 'spacious')}
						class="rounded px-1.5 py-0.5 text-[10px] {sidebarSize === 'spacious'
							? 'bg-blue-100 text-blue-700'
							: 'text-gray-500 hover:bg-gray-100'}"
						title="ゆったり"
					>
						大
					</button>
				</div>
			</div>
		</nav>

		<!-- Footer -->
		<div
			class="mt-auto flex flex-col border-t border-gray-200 {sidebarSize === 'compact'
				? 'p-3'
				: sidebarSize === 'normal'
					? 'p-4'
					: 'p-5'}"
		>
			<a
				href="https://github.com/eycjur/helpful_tools"
				target="_blank"
				rel="noopener noreferrer"
				class="flex items-center text-gray-600 transition-colors hover:text-gray-800"
			>
				<Icon
					icon="mdi:github"
					class={sidebarSize === 'compact' ? 'mr-1.5 h-4 w-4' : 'mr-2 h-5 w-5'}
				/>
				<span class={sidebarSize === 'compact' ? 'text-xs' : 'text-sm'}>GitHub</span>
			</a>
		</div>
	</div>
</aside>
