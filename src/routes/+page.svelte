<script lang="ts">
  import { tools } from '$lib/data/tools';
</script>

<svelte:head>
	<title>Home</title>
	<meta name="description" content="Svelte demo app" />
</svelte:head>

<section class="max-w-4xl mx-auto">
	<h1 class="text-3xl font-bold mb-8 text-center">便利ツール一覧</h1>
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
	{#each tools as tool}
		<a href={tool.path} class="block bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow duration-200 hover:border-blue-300">
			<div class="flex items-center mb-3">
				<span class="text-3xl mr-3">{tool.icon}</span>
				<h2 class="text-xl font-semibold text-gray-800">{tool.name}</h2>
			</div>
			<p class="text-gray-600">{tool.description}</p>
		</a>
	{/each}
	</div>
</section>

