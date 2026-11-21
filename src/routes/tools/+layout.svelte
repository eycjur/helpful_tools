<script lang="ts">
	import { page } from '$app/stores';
	import { tools } from '$lib/data/tools';

	$: tool = tools.find((entry) => $page.route.id === `/tools/${entry.name}`);
</script>

<svelte:head>
	<title>{tool?.nameJa} | 困った時のツール集</title>
	<meta name="description" content={tool?.description} />
</svelte:head>

<slot />
