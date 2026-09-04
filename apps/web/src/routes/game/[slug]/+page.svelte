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

	{#if data.similar.length > 0}
		<section class="similar">
			<SectionHeading>Similar games</SectionHeading>
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

	/* The parent line belongs with the heading, not a third of the way down. */
	> h1 + .parent-of {
		margin-top: -16px;
	}

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

.parent-of {
	font-size: 0.8125rem;
	color: var(--color-grey-400);
	letter-spacing: 0.01em;
	line-height: 1.2;
	text-box: trim-both cap alphabetic;

	@media (min-width: 632px) {
		font-size: 0.875rem;
	}

	> a {
		color: var(--color-grey-200);
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
	letter-spacing: 0.02em;
	text-transform: uppercase;
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
		align-items: baseline;
		gap: 8px;
		font-size: 0.875rem;
		line-height: 1.3;
	}
}

.related-kind {
	font-size: 0.6875rem;
	color: var(--color-grey-400);
	letter-spacing: 0.02em;
	text-transform: uppercase;
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
