<script lang="ts">
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()
</script>

<svelte:head><title>Search: {data.query} · Respawn Social</title></svelte:head>

<h1>Results for "{data.query}"</h1>
{#if data.games.length === 0}
	<p>No games found.</p>
{:else}
	<ul>
		{#each data.games as game}
			<li><a href="/game/{game.slug}/">{game.name}</a></li>
		{/each}
	</ul>
{/if}
