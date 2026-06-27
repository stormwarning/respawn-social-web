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
	<p>Website: {data.site}</p>
	<p>IGDB: {data.game.url}</p>
	<p>Where to play:</p>
	<ul>{#each data.game.external_games as item}<li>{item.url}</li>{/each}</ul>
	<p>Developer: {data.game.developer}</p>
	<p>Publisher: {data.game.publisher}</p>
	<p>Platforms:</p>
	<ul>{#each data.game.platforms as platform}<li>{platform.name}</li>{/each}</ul>
	<p>Genres:</p>
	<ul>{#each data.game.genres as genre}<li>{genre.name}</li>{/each}</ul>
</article>
