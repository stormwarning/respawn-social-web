<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.game.name} · Respawn Social</title>
</svelte:head>

<article>
	<h1>{data.game.name}</h1>
	<img src="{data.game.cover?.url}" alt="" />
	{#if data.game.summary}
		<p>{data.game.summary}</p>
	{/if}
	Developer: {data.game.developer}
	Publisher: {data.game.publisher}
	<p>Platforms: {#each data.game.platforms as platform}{platform.name}<br>{/each}</p>
	<p>Genres: {#each data.game.genres as genre}{genre.name}<br>{/each}</p>
</article>
