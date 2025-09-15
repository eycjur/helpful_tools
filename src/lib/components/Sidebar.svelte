<script lang="ts">
	import { tools } from '$lib/data/tools';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import Icon from '@iconify/svelte';
	import { SvelteMap } from 'svelte/reactivity';

	export let isOpen = false;

	$: currentPath = $page.url.pathname;

	// カテゴリごとにツールをグループ化
	const groupedTools = groupByCategory(tools);

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
		QRコード: 'mdi:qrcode',
		'開発・比較ツール': 'mdi:wrench',
		'ネットワーク・情報': 'mdi:network'
	};
</script>

<!-- Overlay -->
{#if isOpen}
	<div
		class="fixed inset-0 z-40 lg:hidden"
		on:click={() => (isOpen = false)}
		on:keydown={(e) => e.key === 'Escape' && (isOpen = false)}
		role="button"
		tabindex="0"
		aria-label="サイドバーを閉じる"
	></div>
{/if}

<!-- Sidebar -->
<aside
	class="bg-opacity-95 lg:bg-opacity-100 fixed top-0 left-0 z-50 h-full w-64 transform bg-white shadow-lg transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:shadow-none {isOpen
		? 'translate-x-0'
		: '-translate-x-full'}"
>
	<div class="flex h-full flex-col">
		<!-- Header -->
		<div class="border-b border-gray-200 p-4">
			<div class="flex items-center justify-between">
				<a
					href={base || '/'}
					class="flex items-center text-lg font-bold text-blue-600 hover:text-blue-700"
					on:click={() => (isOpen = false)}
				>
					<Icon icon="mdi:tools" class="mr-2 h-6 w-6" />
					困った時のツール集
				</a>
				<button
					class="rounded p-1 hover:bg-gray-100 lg:hidden"
					on:click={() => (isOpen = false)}
					aria-label="サイドバーを閉じる"
				>
					<Icon icon="mdi:close" class="h-6 w-6" />
				</button>
			</div>
		</div>

		<!-- Navigation -->
		<nav class="flex-1 overflow-y-auto p-4">
			<div class="space-y-2">
				<!-- Home -->
				<a
					href={base || '/'}
					class="flex items-center rounded-lg p-3 text-gray-700 transition-colors hover:bg-gray-100 {currentPath ===
					(base || '/')
						? 'bg-blue-50 text-blue-700'
						: ''}"
					on:click={() => (isOpen = false)}
				>
					<Icon icon="mdi:home" class="mr-3 h-5 w-5" />
					<span class="font-medium">ホーム</span>
				</a>

				<!-- ツール（カテゴリ別） -->
				<div class="mt-6 space-y-4">
					{#each [...groupedTools.entries()] as [category, categoryTools] (category)}
						<div>
							<div class="mb-2 flex items-center px-2">
								{#if categoryIcons[category]}
									<Icon icon={categoryIcons[category]} class="mr-2 h-4 w-4 text-blue-600" />
								{/if}
								<h3 class="text-xs font-semibold tracking-wider text-gray-500 uppercase">
									{category}
								</h3>
							</div>
							<div class="space-y-0.5">
								{#each categoryTools as tool (tool.name)}
									{@const toolPath = `${base || ''}/tools/${tool.name}`}
									<a
										href={toolPath}
										class="flex items-center rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100 {currentPath ===
										toolPath
											? 'bg-blue-50 text-blue-700'
											: ''}"
										on:click={() => (isOpen = false)}
									>
										<Icon icon={tool.icon} class="mr-3 h-4 w-4" />
										<span class="truncate text-sm font-medium">{tool.nameJa}</span>
									</a>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</div>
		</nav>

		<!-- Footer -->
		<div class="border-t border-gray-200 p-4">
			<a
				href="https://github.com/eycjur/helpful_tools"
				target="_blank"
				rel="noopener noreferrer"
				class="flex items-center text-gray-600 transition-colors hover:text-gray-800"
			>
				<Icon icon="mdi:github" class="mr-2 h-5 w-5" />
				<span class="text-sm">GitHub</span>
			</a>
		</div>
	</div>
</aside>
