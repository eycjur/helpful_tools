<script lang="ts">
  import { tools } from '$lib/data/tools';
</script>

<svelte:head>
	<title>Home</title>
	<meta name="description" content="Svelte demo app" />
</svelte:head>

<section>
	<h1>便利ツール一覧</h1>
	<ul>
	{#each tools as tool}
		<li>
		<a href={tool.path}>{tool.name} - {tool.description}</a>
		</li>
	{/each}
	</ul>
</section>

<style>
	section {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		flex: 0.6;
	}

	h1 {
		width: 100%;
	}
</style>
