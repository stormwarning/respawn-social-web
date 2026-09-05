<script lang="ts">
import CoverList from '$lib/components/cover-list.svelte'
import Pagination from '$lib/components/pagination.svelte'
import type { PageData } from './$types'
import { browsePath, filterTitle } from '../filters'
import YearMenu from '../year-menu.svelte'

let { data }: { data: PageData } = $props()

let title = $derived(filterTitle(data.filters))
// Pagination appends `/` or `/page/N/` itself.
let basePath = $derived(browsePath(data.filters).replace(/\/$/, ''))
</script>

<svelte:head>
	<title>{title}{data.page > 1 ? ` ▪ Page ${data.page}` : ''} ▪ Respawn</title>
</svelte:head>

<article class="page">
	<header class="header">
		<h1>{title}</h1>
		<YearMenu filters={data.filters} thisYear={data.thisYear} />
	</header>

	{#if data.games.length === 0}
		<p>No games found.</p>
	{:else}
		<section>
			<CoverList items={data.games} />

			{#if data.totalPages > 1}
				<Pagination page={data.page} totalPages={data.totalPages} {basePath} label="Games pages" />
			{/if}
		</section>
	{/if}
</article>

<style>
.header {
	display: flex;
	flex-wrap: wrap;
	gap: 16px;
	align-items: center;
	justify-content: space-between;
}

h1 {
	font-size: 1.5rem;
	font-weight: 600;
	line-height: 1.2;
	text-box: trim-both cap alphabetic;
}

section {
	display: grid;
	gap: 16px;
}
</style>
