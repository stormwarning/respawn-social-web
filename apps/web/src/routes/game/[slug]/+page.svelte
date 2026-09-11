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

// The game this one was ported from, folded underneath it — Super Mario
// Bros. 2 carries Doki-doki Panic. Its native-script title makes the subtitle
// when IGDB has one; the romanized name otherwise.
let original = $derived(game.folded.find((m) => m.foldType === 'original'))
let subtitle = $derived(original ? (original.localizedName ?? original.displayName) : null)
let subtitleLang = $derived(
	original?.localizedName ? (original.localizedLang ?? undefined) : undefined,
)

// Additional releases read as one list per kind — every remake together, every
// expansion together, each group oldest first. IGDB's own order is popularity,
// which scatters them.
let relatedGroups = $derived.by(() => {
	const groups = new Map<string, typeof game.related>()
	for (const item of game.related) {
		const key = item.relation ?? 'Other'
		const items = groups.get(key)
		if (items) items.push(item)
		else groups.set(key, [item])
	}
	return [...groups].map(([relation, items]) => ({
		relation,
		items: [...items].sort(
			(a, b) =>
				(a.releaseYear ?? Number.POSITIVE_INFINITY) - (b.releaseYear ?? Number.POSITIVE_INFINITY),
		),
	}))
})
</script>

<svelte:head>
	<title>{game.displayName} ▪ Respawn</title>
</svelte:head>

<article class="page">
	<header class="game-header">
		<div class="title-block">
			<div class="title">
				<h1>{game.displayName}</h1>
				{#if subtitle}
					<p class="subtitle" lang={subtitleLang}>{subtitle}</p>
				{/if}
			</div>
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
		{#if game.publishers}
			<div class="details-block">
				<h4>Publishers</h4>
				<ul class="list">
					{#each game.publishers as publisher}
						<li><Chip>{publisher}</Chip></li>
					{/each}
				</ul>
			</div>
		{/if}

		{#if game.platforms}
			<div class="details-block">
				<h4>Platforms</h4>
				<ul class="list">
					{#each game.platforms as platform}
						<li><Chip>{platform.displayName}</Chip></li>
					{/each}
				</ul>
			</div>
		{/if}

		{#if game.genres}
			<div class="details-block">
				<h4>Genres</h4>
				<ul class="list">
					{#each game.genres as genre}
						<li><Chip>{genre.displayName}</Chip></li>
					{/each}
				</ul>
			</div>
		{/if}

		{#if foldedGroups.length > 0}
			{#each foldedGroups as group}
				<div class="details-block">
					<h4>{group.heading}</h4>
					<p class="folded-names">{group.names.join(', ')}</p>
				</div>
			{/each}
		{/if}

		{#if relatedGroups.length > 0}
			<div class="details-block">
				<h4>Additional releases</h4>
				<ul class="folded">
					{#each relatedGroups as group}
						<li>
							<span class="folded-heading">{group.relation}</span>
							<ul class="related">
								{#each group.items as item}
									<li>
										<a href="/game/{item.slug}/">{item.displayName}</a>
										{#if item.releaseYear}<span class="related-year">{item.releaseYear}</span>{/if}
									</li>
								{/each}
							</ul>
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

.title-block {
	display: grid;
	gap: 24px;
	align-content: start;
}

.title {
	display: grid;
	gap: 12px;
	align-content: start;

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

.subtitle {
	font-size: 1rem;
	line-height: 1.2;
	color: var(--color-grey-400);
	text-box: trim-both cap alphabetic;

	@media (width >= 632px) {
		font-size: 1.125rem;
	}
}

.parent-of {
	font-size: 0.875rem;
	line-height: 1.2;
	color: var(--color-grey-400);
	text-box: trim-both cap alphabetic;

	@media (width >= 632px) {
		font-size: 1rem;
	}

	> a {
		color: var(--color-grey-100);
		text-decoration: none;

		&:hover {
			color: var(--color-grey-300);
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
