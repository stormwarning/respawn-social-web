<script lang="ts">
import Chip from '$lib/components/chip.svelte'
import ClampText from '$lib/components/clamp-text.svelte'
import CoverImage from '$lib/components/cover-image.svelte'
import CoverList from '$lib/components/cover-list.svelte'
import GameActions from '$lib/components/game-actions.svelte'
import SectionHeading from '$lib/components/section-heading.svelte'
import { groupFolded } from '$lib/folded'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()
let { game } = $derived(data)
let developers = $derived(game.developers.join(', '))

let foldedGroups = $derived(groupFolded(game.folded, game.displayName))
</script>

<svelte:head>
	<title>{game.displayName} ▪ Respawn</title>
</svelte:head>

<article class="page">
	<header class="game-header">
		<div class="title">
			<h1>{game.displayName}</h1>
			{#if game.parent}
				<p class="parent-of">
					{game.relationToParent ?? 'Version'} of
					<a href="/game/{game.parent.slug}/">{game.parent.displayName}</a>
				</p>
			{/if}
			<div class="title-meta">
				<span>{game.releaseYear}</span>
				{#if game.releaseYear && developers}<span role="separator">▪</span>{/if}
				<span>{developers}</span>
			</div>
		</div>

		<div class="game-cover">
			<CoverImage image={game.coverUrl} loading="eager" />
		</div>
	</header>

	<section class="game-intro">
		{#if game.summaryDisplay}
			<div class="summary">
				<ClampText text={game.summaryDisplay} />
			</div>
		{/if}

		<div class="actions">
			<GameActions
				isLoggedIn={data.isLoggedIn}
				igdbId={game.id}
				slug={game.slug}
				title={game.displayName}
				coverUrl={game.coverUrl ?? ''}
				releaseDate={game.firstReleaseDate ?? ''}
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
				{#each game.publishers as publisher}
					<li><Chip>{publisher}</Chip></li>
				{/each}
			</ul>
		</div>
		<div class="details-block">
			<h4>Platforms</h4>
			<ul class="list">
				{#each game.platforms as platform}
					<li><Chip>{platform.displayName}</Chip></li>
				{/each}
			</ul>
		</div>
		<div class="details-block">
			<h4>Genres</h4>
			<ul class="list">
				{#each game.genres as genre}
					<li><Chip>{genre.displayName}</Chip></li>
				{/each}
			</ul>
		</div>
		{#if foldedGroups.length > 0}
			<div class="details-block">
				<h4>Includes</h4>
				<ul class="folded">
					{#each foldedGroups as group}
						<li>
							<span class="folded-heading">{group.heading}</span>
							<span class="folded-names">{group.names.join(', ')}</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
		{#if game.related.length > 0}
			<div class="details-block">
				<h4>Released separately</h4>
				<ul class="related">
					{#each game.related as item}
						<li>
							<a href="/game/{item.slug}/">{item.displayName}</a>
							{#if item.relation}<span class="related-kind">{item.relation}</span>{/if}
							{#if item.releaseYear}<span class="related-year">{item.releaseYear}</span>{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/if}
		{#if game.igdbUrl || data.site}
			<div class="details-more">
				<span>More at</span>
				{#if game.igdbUrl}
					<a class="outline-button small" href={game.igdbUrl} rel="noopener noreferrer">
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
		{#each data.game.externalGames as item}<li>{item.url}</li>{/each}
	</ul> -->

	{#if data.series.length > 0}
		<section class="cover-section">
			<SectionHeading>
				<a href="/game/{game.slug}/related/">Related games</a>
			</SectionHeading>
			<CoverList items={data.series} cols={4} />
		</section>
	{/if}

	{#if data.similar.length > 0}
		<section class="cover-section">
			<SectionHeading>
				<a href="/game/{game.slug}/similar/">Similar games</a>
			</SectionHeading>
			<CoverList items={data.similar} cols={4} />
		</section>
	{/if}
</article>

<aside class="sidebar">
	<CoverImage image={game.coverUrl} loading="eager" />
</aside>

<style>
.page {
	display: grid;
	grid-template-columns: 100%;
	gap: 32px;

	@media (width >= 632px) {
		padding-inline-end: calc(clamp(120px, 27cqi, 230px) + 16px);

		.game-cover {
			display: none;
		}
	}
}

.game-header {
	display: grid;
	grid-template-columns: 1fr min(33vi, 230px);
	gap: 16px;

	@media (width >= 632px) {
		grid-template-columns: 1fr;
	}
}

/* Declared before `.title` so the `> h1 + .parent-of` override nested there
   follows it on source order as well as specificity. */
.parent-of {
	font-size: 0.8125rem;
	line-height: 1.2;
	color: var(--color-grey-400);
	letter-spacing: 0.01em;
	text-box: trim-both cap alphabetic;

	@media (width >= 632px) {
		font-size: 0.875rem;
	}

	> a {
		color: var(--color-grey-200);
	}
}

.title {
	display: grid;
	gap: 24px;
	align-content: start;

	/* The parent line belongs with the heading, not a third of the way down. */
	> h1 + .parent-of {
		margin-block-start: -16px;
	}

	h1 {
		font-size: 1.375rem;
		font-weight: 600;
		line-height: 1.2;
		text-box: trim-both cap alphabetic;

		@media (width >= 632px) {
			font-size: 2rem;
		}
	}
}

.title-meta {
	display: flex;
	gap: 4px;
	font-size: 0.75rem;
	line-height: 1.2;
	letter-spacing: 0.02em;

	@media (width >= 632px) {
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
	grid-template-columns: 100%;
	gap: 32px;

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
		text-transform: uppercase;
		letter-spacing: 0.02em;
		text-box: trim-both cap alphabetic;
	}
}

.details-more {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	align-items: baseline;
	padding-block-start: 16px;

	/* Collides with `.title-meta > span:not([role='separator'])` above, but
	   `.title-meta` and `.details-more` are never applied to the same element. */
	/* stylelint-disable-next-line no-descending-specificity */
	> span {
		font-size: 0.875rem;
		letter-spacing: 0.01em;
		text-box: trim-both cap alphabetic;
	}
}

.folded {
	display: grid;
	gap: 8px;
	padding: 0;
	list-style: none;

	> li {
		display: grid;
		gap: 2px;

		@container (min-width: 520px) {
			grid-template-columns: 108px 1fr;
			gap: 12px;
		}
	}
}

.folded-heading {
	font-size: 0.75rem;
	color: var(--color-grey-400);
	text-transform: uppercase;
	letter-spacing: 0.02em;
	text-box: trim-both cap alphabetic;
}

.folded-names {
	font-size: 0.875rem;
	line-height: 1.4;
	text-wrap: pretty;
}

.related {
	display: grid;
	gap: 8px;
	padding: 0;
	list-style: none;

	> li {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: baseline;
		font-size: 0.875rem;
		line-height: 1.3;
	}
}

.related-kind {
	font-size: 0.6875rem;
	color: var(--color-grey-400);
	text-transform: uppercase;
	letter-spacing: 0.02em;
}

.related-year {
	font-size: 0.75rem;
	color: var(--color-grey-500);
}

.list {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	padding: 0;
	list-style: none;
}

.cover-section {
	display: grid;
	gap: 16px;
}

.sidebar {
	position: absolute;
	inset-block-start: var(--block-spacing);
	inset-inline-end: var(--inline-spacing);
	inline-size: 100%;
	max-inline-size: calc(clamp(120px, 27cqi, 230px) - 16px);

	@media (width <= 631px) {
		display: none;
	}
}
</style>
