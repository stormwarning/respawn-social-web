<script lang="ts">
import Chip from '$lib/components/chip.svelte'
import CoverImage from '$lib/components/cover-image.svelte'
import GameActions from '$lib/components/game-actions.svelte'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()
let { game } = $derived(data)
</script>

<svelte:head>
	<title>{game.name} 🞍 Respawn</title>
</svelte:head>

<article class="page">
	<header class="game-header">
		<div class="title">
			<h1>{game.name}</h1>
			<div class="title-meta">
				<span>{game.releaseYear}</span>
				{#if game.releaseYear && game.developer}<span role="separator">🞍</span>{/if}
				<span>{game.developer}</span>
			</div>
		</div>
		<CoverImage image={game.cover?.url} />
	</header>

	{#if game.summary}
		<p>{game.summary}</p>
	{/if}

	<GameActions
		isLoggedIn={data.isLoggedIn}
		igdbId={game.id}
		slug={game.slug}
		title={game.name}
		coverUrl={game.cover?.url ?? ''}
		played={data.played}
		liked={data.liked}
		inBacklog={data.inBacklog}
	/>

	<section class="details">
		<div class="details-block">
			<h4>Publishers</h4>
			<ul class="list">
				{#each game.publisher as publisher}
					<li><Chip>{publisher}</Chip></li>
				{/each}
			</ul>
		</div>
		<div class="details-block">
			<h4>Platforms</h4>
			<ul class="list">
				{#each game.platforms as platform}
					<li><Chip>{platform.name}</Chip></li>
				{/each}
			</ul>
		</div>
		<div class="details-block">
			<h4>Genres</h4>
			<ul class="list">
				{#each game.genres as genre}
					<li><Chip>{genre.name}</Chip></li>
				{/each}
			</ul>
		</div>
		{#if game.url || data.site}
			<div class="details-more">
				<span>More at</span>
				{#if game.url}<a href={game.url} rel="noopener noreferrer">IGDB</a>{/if}
				{#if data.site}<a href={data.site} rel="noopener noreferrer">Official</a>{/if}
			</div>
		{/if}
	</section>
	<!-- <p>Where to play:</p>
	<ul>
		{#each data.game.external_games as item}<li>{item.url}</li>{/each}
	</ul> -->
</article>

<style>
.page {
	display: grid;
	gap: 32px;
	grid-template-columns: 100%;
	padding-top: 16px;

	p {
		font-size: 0.9375rem;
		text-wrap: pretty;
	}
}

.game-header {
	display: grid;
	grid-template-columns: 1fr min(33vw, 230px);
	gap: 16px;
}

.title {
	display: grid;
	align-content: start;
	gap: 24px;

	h1 {
		font-size: 1.375rem;
		font-weight: 600;
		line-height: 1.2;
	}
}

.title-meta {
	display: flex;
	gap: 4px;
	font-size: 0.75rem;
	letter-spacing: 0.02em;
	line-height: 1.2;

	> span:not([role='separator']) {
		color: var(--color-grey-400);
	}

	> span[role='separator'] {
		color: var(--color-grey-500);
	}
}

.details {
	display: grid;
	gap: 16px;
	padding: 16px;
	background-color: var(--color-grey-800);
	border-radius: 8px;
	corner-shape: var(--corner-shape);
}

.details-block {
	display: grid;
	gap: 12px;

	> h4 {
		font-size: 0.875rem;
		font-weight: 400;
		color: var(--color-grey-300);
		letter-spacing: 0.02em;
		text-box: trim-both cap alphabetic;
		text-transform: uppercase;
	}
}

.details-more {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	gap: 8px;
	padding-top: 16px;

	> span {
		font-size: 0.875rem;
		letter-spacing: 0.01em;
		text-box: trim-both cap alphabetic;
	}

	> a {
		padding: 4px;
		font-size: 0.75rem;
		color: var(--color-blue-100);
		letter-spacing: 0.02em;
		text-box: trim-both cap alphabetic;
		text-decoration: none;
		border: 1px solid var(--color-grey-400);
	}
}

.list {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	padding: 0;
	list-style: none;
}
</style>
