<script lang="ts">
	import { tools } from '$lib/data/tools';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import Icon from '@iconify/svelte';

	export let isOpen = false;

	$: currentPath = $page.url.pathname;
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
	class="fixed top-0 left-0 z-50 h-full w-64 transform bg-white bg-opacity-95 shadow-lg transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:bg-opacity-100 lg:shadow-none {isOpen
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

				<!-- Tools -->
				<div class="mt-6">
					<h3 class="mb-2 px-3 text-sm font-semibold tracking-wider text-gray-500 uppercase">
						ツール
					</h3>
					<div class="space-y-1">
						{#each tools as tool (tool.name)}
							{@const toolPath = `${base || ''}/tools/${tool.name}`}
							<a
								href={toolPath}
								class="flex items-center rounded-lg p-3 text-gray-700 transition-colors hover:bg-gray-100 {currentPath ===
								toolPath
									? 'bg-blue-50 text-blue-700'
									: ''}"
								on:click={() => (isOpen = false)}
							>
								<Icon icon={tool.icon} class="mr-3 h-5 w-5" />
								<div class="min-w-0 flex-1">
									<div class="truncate font-medium">{tool.nameJa}</div>
									<div class="truncate text-sm text-gray-500">{tool.description}</div>
								</div>
							</a>
						{/each}
					</div>
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
