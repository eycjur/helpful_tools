<script>
	import '../app.css';
	import { base } from '$app/paths';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Icon from '@iconify/svelte';

	let sidebarOpen = false;

	function toggleSidebar() {
		sidebarOpen = !sidebarOpen;
	}
</script>

<div class="flex h-screen">
	<!-- Sidebar -->
	<Sidebar bind:isOpen={sidebarOpen} />

	<!-- Main Content -->
	<div class="flex flex-1 flex-col">
		<header class="bg-gray-100 p-4 lg:hidden">
			<nav class="flex items-center justify-between">
				<button
					on:click={toggleSidebar}
					class="rounded p-2 hover:bg-gray-200"
					aria-label="メニューを開く"
				>
					<Icon icon="mdi:menu" class="h-6 w-6" />
				</button>
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

		<main class="flex-1 overflow-y-auto p-8">
			<slot />
		</main>

		<footer class="mt-auto bg-gray-100 p-4 text-center">
			<p>&copy; {new Date().getFullYear()} 困った時のツール集</p>
		</footer>
	</div>
</div>
