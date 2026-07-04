<script lang="ts">
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()
</script>

<svelte:head>
	<title>{data.name} · list by @{data.handle} · Respawn Social</title>
</svelte:head>

<article>
	<h1>{data.name}</h1>
	<p class="sub">A list by <a href="/{data.handle}/">@{data.handle}</a></p>
	{#if data.description}
		<p>{data.description}</p>
	{/if}

	{#if data.items.length === 0}
		<p class="sub">This list is empty.</p>
	{:else if data.ranked}
		<ol>
			{#each data.items as game (game.igdbId)}
				<li><a href="/game/{game.slug}/">{game.title}</a></li>
			{/each}
		</ol>
	{:else}
		<ul>
			{#each data.items as game (game.igdbId)}
				<li><a href="/game/{game.slug}/">{game.title}</a></li>
			{/each}
		</ul>
	{/if}
</article>

<style>
.sub {
	color: var(--color-muted);
	font-size: var(--text-sm);
}
</style>
