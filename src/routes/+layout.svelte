<script>
	import '../app.css';
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Icon from '@iconify/svelte';

	let sidebarOpen = false;

	$: isTopPage =
		$page.url.pathname === (base || '/') || $page.url.pathname === (base ? `${base}/` : '/');

	function toggleSidebar() {
		sidebarOpen = !sidebarOpen;
	}
</script>

<div class="flex h-screen">
	<!-- Sidebar（トップページでは非表示） -->
	{#if !isTopPage}
		<Sidebar bind:isOpen={sidebarOpen} />
	{/if}

	<!-- Main Content -->
	<div class="flex flex-1 flex-col">
		<header class="bg-gray-100 p-4 lg:hidden">
			<nav class="flex items-center justify-between">
				{#if !isTopPage}
					<button
						on:click={toggleSidebar}
						class="rounded p-2 hover:bg-gray-200"
						aria-label="メニューを開く"
					>
						<Icon icon="mdi:menu" class="h-6 w-6" />
					</button>
				{:else}
					<span></span>
				{/if}
				<a href={base || '/'} class="font-bold text-blue-500 hover:underline">困った時のツール集</a>
				<a
					href="https://github.com/eycjur/helpful_tools"
					target="_blank"
					rel="noopener noreferrer"
					class="text-gray-600 transition-colors hover:text-gray-800"
					aria-label="GitHub"
				>
					<Icon icon="mdi:github" class="h-6 w-6" />
				</a>
			</nav>
		</header>

		<main class="flex-1 overflow-y-auto p-4 lg:p-6">
			<slot />
		</main>

		<footer class="border-t border-gray-200 bg-white p-4">
			<div class="flex flex-col items-center justify-center gap-1 sm:flex-row sm:gap-3">
				<span class="text-sm text-gray-600"
					>&copy; {new Date().getFullYear()} 困った時のツール集</span
				>
				<a
					href="{base}/terms"
					class="text-sm text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline"
					>利用規約</a
				>
			</div>
		</footer>
	</div>
</div>
