<script lang="ts">
import CoverList from '$lib/components/cover-list.svelte'
import Pagination from '$lib/components/pagination.svelte'
import ProfileNav from '$lib/components/profile-nav.svelte'
import SectionHeading from '$lib/components/section-heading.svelte'
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
	<title>{title}{data.page > 1 ? ` ▪ Page ${data.page}` : ''} ▪ Respawn</title>
</svelte:head>

<article class="page">
	<ProfileNav
		handle={data.handle}
		displayName={data.displayName}
		avatarUrl={data.avatarUrl}
		isSelf={data.isSelf}
	/>

	{#if data.playing.length === 0 && data.played.length === 0}
		<p>{data.isSelf ? 'You haven’t tracked any games yet.' : 'No games tracked yet.'}</p>
	{/if}

	{#if data.playing.length > 0}
		<section>
			<SectionHeading>{playingHeading}</SectionHeading>
			{@render gameList(data.playing)}
		</section>
	{/if}

	{#if data.played.length > 0}
		<section>
			<SectionHeading>{playedHeading}</SectionHeading>
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
section {
	display: grid;
	gap: 16px;
}
</style>
