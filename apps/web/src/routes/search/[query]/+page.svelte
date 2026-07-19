<script lang="ts">
import Chip from '$lib/components/chip.svelte'
import CoverImage from '$lib/components/cover-image.svelte'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()
</script>

<svelte:head><title>Search results for {data.query} 🞍 Respawn</title></svelte:head>

<article class="page">
	<h1>Results for “{data.query}”</h1>

	{#if data.games.length === 0}
		<p>No games found.</p>
	{:else}
		<ul class="results">
			{#each data.games as game, index}
				<li class="result">
					<a href="/game/{game.slug}/" tabindex="-1" aria-hidden="true">
						<CoverImage image={game.coverUrl} />
					</a>
					<div class="result-content">
						<span class="result-title">
							<a class="title" href="/game/{game.slug}/">{game.name}</a>
							{#if game.year}
								<span class="year">{game.year}</span>
							{/if}
						</span>
						{#if game.platforms}
							<div class="platforms">
								{#each game.platforms as platform}
									<Chip>{platform.name}</Chip>
								{/each}
							</div>
						{/if}
					</div>
				</li>
				{#if index !== data.games.length - 1}
					<hr />
				{/if}
			{/each}
		</ul>
	{/if}
</article>

<style>
.page {
	display: grid;
	gap: 32px;
	padding: 32px 0;
}

h1 {
	font-size: 1.5rem;
	font-weight: 600;
	line-height: 1.2;
	text-box: trim-both cap alphabetic;
}

.results {
	display: grid;
	gap: 24px;
	margin: 0;
	padding: 0;
	list-style: none;
}

.result {
	display: grid;
	grid-template-columns: 72px 1fr;
	gap: 16px;
	padding: 0;
}

.result-content {
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.result-title {
	align-items: baseline;
	font-size: 1.375rem;
	line-height: 1.2;
	text-box: trim-both cap alphabetic;
}

.title {
	font-weight: 600;
	text-box: trim-both cap alphabetic;
	text-decoration: none;

	&:hover {
		color: var(--color-blue-500);
	}
}

.year {
	font-size: 1.125cap;
	color: var(--color-muted);
	text-box: trim-both cap alphabetic;
}

.platforms {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}
</style>
