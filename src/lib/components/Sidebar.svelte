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
		class="bg-opacity-50 fixed inset-0 z-40 bg-black lg:hidden"
		on:click={() => (isOpen = false)}
		on:keydown={(e) => e.key === 'Escape' && (isOpen = false)}
		role="button"
		tabindex="0"
		aria-label="サイドバーを閉じる"
	></div>
{/if}

<!-- Sidebar -->
<aside
	class="fixed top-0 left-0 z-50 h-full w-64 transform bg-white shadow-lg transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:shadow-none {isOpen
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
					<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						></path>
					</svg>
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
				<svg class="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
					<path
						fill-rule="evenodd"
						d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z"
						clip-rule="evenodd"
					></path>
				</svg>
				<span class="text-sm">GitHub</span>
			</a>
		</div>
	</div>
</aside>
