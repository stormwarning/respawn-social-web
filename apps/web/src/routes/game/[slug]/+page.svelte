<script lang="ts">
import Chip from '$lib/components/chip.svelte'
import ClampText from '$lib/components/clamp-text.svelte'
import CoverImage from '$lib/components/cover-image.svelte'
import CoverList from '$lib/components/cover-list.svelte'
import GameActions from '$lib/components/game-actions.svelte'
import SectionHeading from '$lib/components/section-heading.svelte'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()
let { game } = $derived(data)
</script>

<svelte:head>
	<title>{game.name} ▪ Respawn</title>
</svelte:head>

<article class="page">
	<header class="game-header">
		<div class="title">
			<h1>{game.name}</h1>
			<div class="title-meta">
				<span>{game.releaseYear}</span>
				{#if game.releaseYear && game.developer}<span role="separator">▪</span>{/if}
				<span>{game.developer}</span>
			</div>
		</div>

		<div class="game-cover">
			<CoverImage image={game.cover?.url} loading="eager" />
		</div>
	</header>

	<section class="game-intro">
		{#if game.summary}
			<div class="summary">
				<ClampText text={game.summary} />
			</div>
		{/if}

		<div class="actions">
			<GameActions
				isLoggedIn={data.isLoggedIn}
				igdbId={game.id}
				slug={game.slug}
				title={game.name}
				coverUrl={game.cover?.url ?? ''}
				played={data.played}
				playing={data.playing}
				liked={data.liked}
				rating={data.rating}
				inBacklog={data.inBacklog}
			/>
		</div>
	</section>

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
				{#if game.url}
					<a class="outline-button small" href={game.url} rel="noopener noreferrer">
						<span>IGDB</span>
					</a>
				{/if}
				{#if data.site}
					<a class="outline-button small" href={data.site} rel="noopener noreferrer">
						<span>Official</span>
					</a>
				{/if}
			</div>
		{/if}
	</section>
	<!-- <p>Where to play:</p>
	<ul>
		{#each data.game.external_games as item}<li>{item.url}</li>{/each}
	</ul> -->

	{#if game.similar_games && game.similar_games.length > 0}
		<section class="similar">
			<SectionHeading>Similar games</SectionHeading>
			<CoverList items={game.similar_games.slice(0, 4)} cols={4} />
		</section>
	{/if}
</article>

<aside class="sidebar">
	<CoverImage image={game.cover?.url} loading="eager" />
</aside>

<style>
.page {
	display: grid;
	gap: 32px;
	grid-template-columns: 100%;

	@media (min-width: 632px) {
		padding-right: calc(clamp(120px, 27cqi, 230px) + 16px);

		.game-cover {
			display: none;
		}
	}
}

.game-header {
	display: grid;
	grid-template-columns: 1fr min(33vw, 230px);
	gap: 16px;

	@media (min-width: 632px) {
		grid-template-columns: 1fr;
	}
}

.title {
	display: grid;
	align-content: start;
	gap: 24px;

	h1 {
		font-size: 1.375rem;
		font-weight: 600;
		line-height: 1.2;
		text-box: trim-both cap alphabetic;

		@media (min-width: 632px) {
			font-size: 2rem;
		}
	}
}

.title-meta {
	display: flex;
	gap: 4px;
	font-size: 0.75rem;
	letter-spacing: 0.02em;
	line-height: 1.2;

	@media (min-width: 632px) {
		font-size: 1rem;
		letter-spacing: 0;
	}

	> span:not([role='separator']) {
		color: var(--color-grey-400);
	}

	> span[role='separator'] {
		color: var(--color-grey-500);
	}
}

.game-intro {
	display: grid;
	gap: 32px;
	grid-template-columns: 100%;

	@container (min-width: 600px) {
		grid-template-columns: 240px 1fr;
		gap: 24px;
	}
}

.summary {
	@container (min-width: 600px) {
		grid-column: 2;
	}
}

.actions {
	@container (min-width: 600px) {
		grid-row: 1;
		grid-column: 1;
	}
}

.details {
	display: grid;
	gap: 16px;
	padding: 16px;
	background-color: var(--color-grey-800);
	border-radius: 6px;

	@supports (corner-shape: squircle) {
		border-radius: 12px;
		corner-shape: var(--corner-shape);
	}
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
}

.list {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	padding: 0;
	list-style: none;
}

.similar {
	display: grid;
	gap: 16px;
}

.sidebar {
	position: absolute;
	top: var(--block-spacing);
	right: var(--inline-spacing);
	width: 100%;
	max-width: calc(clamp(120px, 27cqi, 230px) - 16px);

	@media (max-width: 631px) {
		display: none;
	}
}
</style>
