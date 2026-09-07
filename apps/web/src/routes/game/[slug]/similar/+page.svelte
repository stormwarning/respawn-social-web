<script lang="ts">
import CoverList from '$lib/components/cover-list.svelte'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()
</script>

<svelte:head>
	<title>Games similar to {data.displayName} ▪ Respawn</title>
</svelte:head>

<article class="page">
	<header class="header">
		<h1>Similar games</h1>
		<a href="/game/{data.slug}/">{data.displayName}</a>
	</header>

	{#if data.games.length === 0}
		<p>No similar games.</p>
	{:else}
		<section>
			<CoverList items={data.games} />
		</section>
	{/if}
</article>

<style>
.header {
	display: flex;
	flex-wrap: wrap;
	gap: 4px 16px;
	align-items: baseline;
	justify-content: space-between;
}

h1 {
	font-size: 1.5rem;
	font-weight: 600;
	line-height: 1.2;
	text-box: trim-both cap alphabetic;
}

/* The game this list belongs to, and the way back to it. */
.header > a {
	font-size: 0.875rem;
	color: var(--color-grey-400);
	letter-spacing: 0.01em;

	&:hover {
		color: var(--color-grey-100);
	}
}

section {
	display: grid;
	gap: 16px;
}
</style>
