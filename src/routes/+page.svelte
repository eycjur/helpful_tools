<script lang="ts">
	import { tools } from '$lib/data/tools';
	import { base } from '$app/paths';
</script>

<svelte:head>
	<title>Home</title>
	<meta name="description" content="Svelte demo app" />
</svelte:head>

<section class="mx-auto max-w-4xl">
	<h1 class="mb-8 text-center text-3xl font-bold">便利ツール一覧</h1>
	<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
		{#each tools as tool (tool.name)}
			<a
				href="{base}/tools/{tool.name}"
				class="block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow duration-200 hover:border-blue-300 hover:shadow-md"
			>
				<div class="mb-3 flex items-center">
					<span class="mr-3 text-3xl">{tool.icon}</span>
					<h2 class="text-xl font-semibold text-gray-800">{tool.nameJa}</h2>
				</div>
				<p class="text-gray-600">{tool.description}</p>
			</a>
		{/each}
	</div>
</section>
