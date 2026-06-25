<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.game.name} · Respawn Social</title>
</svelte:head>

<article>
	<h1>{data.game.name}</h1>
	{#if data.game.summary}
		<p>{data.game.summary}</p>
	{/if}
</article>
