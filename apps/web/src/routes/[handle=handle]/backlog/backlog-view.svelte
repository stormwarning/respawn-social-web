<script lang="ts">
import CoverList from '$lib/components/cover-list.svelte'
import Pagination from '$lib/components/pagination.svelte'
import ProfileNav from '$lib/components/profile-nav.svelte'
import SectionHeading from '$lib/components/section-heading.svelte'
import type { loadBacklogPage } from './load'

let { data }: { data: Awaited<ReturnType<typeof loadBacklogPage>> } = $props()

let heading = $derived(data.isSelf ? 'You want to play' : `${data.displayName} wants to play`)
let title = $derived(data.isSelf ? 'Your backlog' : `${data.displayName}’s backlog`)
let year = (releaseDate: string | null) => releaseDate?.slice(0, 4) ?? ''
</script>

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

	<section>
		{#if data.items.length === 0}
			<p>{data.isSelf ? 'Nothing in your backlog yet.' : 'Nothing in this backlog yet.'}</p>
		{:else}
			<SectionHeading>{heading}</SectionHeading>
			<CoverList items={data.items} />

			{#if data.totalPages > 1}
				<Pagination
					page={data.page}
					totalPages={data.totalPages}
					basePath="/{data.handle}/backlog"
					label="Backlog pages"
				/>
			{/if}
		{/if}
	</section>
</article>

<style>
section {
	display: grid;
	gap: 16px;
}
</style>
