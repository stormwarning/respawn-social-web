<script lang="ts">
import CoverList from '$lib/components/cover-list.svelte'
import Pagination from '$lib/components/pagination.svelte'
import type { loadGamesPage } from './load'

type Data = Awaited<ReturnType<typeof loadGamesPage>>

let { data }: { data: Data } = $props()

let title = $derived(data.isSelf ? 'Your games' : `${data.displayName}’s games`)
let playingHeading = $derived(data.isSelf ? 'You’re playing' : `${data.displayName} is playing`)
let playedHeading = $derived(data.isSelf ? 'You’ve played' : `${data.displayName} has played`)
</script>

{#snippet gameList(items: Data['played'])}
	<CoverList {items} />
{/snippet}

<svelte:head>
	<title>{title}{data.page > 1 ? ` · Page ${data.page}` : ''} 🞍 Respawn</title>
</svelte:head>

<article class="page">
	<h1>{title}</h1>

	{#if data.playing.length === 0 && data.played.length === 0}
		<p>{data.isSelf ? 'You haven’t tracked any games yet.' : 'No games tracked yet.'}</p>
	{/if}

	{#if data.playing.length > 0}
		<section>
			<h2>{playingHeading}</h2>
			{@render gameList(data.playing)}
		</section>
	{/if}

	{#if data.played.length > 0}
		<section>
			<h2>{playedHeading}</h2>
			{@render gameList(data.played)}

			{#if data.totalPages > 1}
				<Pagination
					page={data.page}
					totalPages={data.totalPages}
					basePath="/{data.handle}/games"
					label="Played games pages"
				/>
			{/if}
		</section>
	{/if}
</article>

<style>
.page {
	display: grid;
	gap: 32px;
	padding: 32px 0;
}

section {
	display: grid;
	gap: 24px;
}

h1 {
	font-size: 1.5rem;
	font-weight: 600;
	line-height: 1.2;
	text-box: trim-both cap alphabetic;
	text-wrap: balance;
}

h2 {
	font-size: 1.25rem;
	font-weight: 600;
	line-height: 1.2;
	text-box: trim-both cap alphabetic;
	text-wrap: balance;
}
</style>
