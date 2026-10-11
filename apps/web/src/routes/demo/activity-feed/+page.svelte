<script lang="ts">
import { page } from '$app/state'
import ActivityFeed from '$lib/components/activity-feed.svelte'
import type { RespawnLogRecord } from '$lib/atproto/log'
import type { PlayedState } from '$lib/atproto/game'
import type { FeedActor, HydratedFeed, HydratedFeedItem } from '$lib/server/feed'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** ISO timestamp `ms` before page load. */
function ago(ms: number): string {
	return new Date(Date.now() - ms).toISOString()
}

function avatar(seed: string): string {
	return `https://api.dicebear.com/9.x/glass/svg?seed=${seed}`
}

function actor(
	did: string,
	handle: string | null,
	displayName: string | null,
	pronouns: string | null = null,
	avatarUrl: string | null = avatar(did),
): FeedActor {
	return { did, handle, displayName, pronouns, avatarUrl }
}

const viewer: FeedActor = {
	did: page.data.user!.did,
	handle: page.data.user!.handle ?? null,
	displayName: page.data.user!.displayName ?? null,
	pronouns: null,
	avatarUrl: page.data.user!.avatarUrl ?? null,
}

const alex = actor('did:plc:alex', 'alex.bsky.social', 'Alex Rivera', 'they/their')
const sam = actor('did:plc:sam', 'sam.respawn.social', 'Sam', 'she/her')
const jordan = actor('did:plc:jordan', 'jordan.dev', 'Jordan', 'he/his')
const noAvatar = actor('did:plc:noavatar', 'quiet.bsky.social', 'Quiet Player', null, null)
const handleOnly = actor('did:plc:handleonly', 'handle-only.bsky.social', null)
const didOnly = actor('did:plc:7f3kq2xw9vmz4bnh6d1c', null, null)
const longName = actor(
	'did:plc:longname',
	'long.bsky.social',
	'Bartholomew “Speedrun Any%” Featherstonehaugh-Wigglesworth III',
	'he/their',
)

const games = {
	outerWilds: { igdbId: 11737, slug: 'outer-wilds', title: 'Outer Wilds' },
	hades: { igdbId: 113112, slug: 'hades', title: 'Hades' },
	celeste: { igdbId: 26226, slug: 'celeste', title: 'Celeste' },
	eldenRing: { igdbId: 119133, slug: 'elden-ring', title: 'Elden Ring' },
	stardew: { igdbId: 17000, slug: 'stardew-valley', title: 'Stardew Valley' },
	disco: { igdbId: 26472, slug: 'disco-elysium', title: 'Disco Elysium' },
	longTitle: {
		igdbId: 1,
		slug: 'long',
		title:
			'The Legend of Heroes: Trails of Cold Steel IV – The End of Saga – Limited Edition Director’s Cut',
	},
}

type Game = (typeof games)[keyof typeof games]

let seq = 0

function item(
	type: HydratedFeedItem['type'],
	by: FeedActor,
	extra: Partial<HydratedFeedItem> = {},
): HydratedFeedItem {
	seq += 1
	return {
		type,
		uri: `at://${by.did}/demo/${seq}`,
		createdAt: ago(seq * 37 * MINUTE),
		actor: by,
		game: null,
		coverUrl: null,
		subject: null,
		log: null,
		...extra,
	}
}

function backlog(by: FeedActor, game: Game = games.hades, extra: Partial<HydratedFeedItem> = {}) {
	return item('backlogAdd', by, { game, ...extra })
}

function follow(by: FeedActor, subject: FeedActor, extra: Partial<HydratedFeedItem> = {}) {
	return item('follow', by, { subject, ...extra })
}

function record(game: Game, fields: Partial<RespawnLogRecord> = {}): RespawnLogRecord {
	return { game, createdAt: ago(HOUR), ...fields }
}

function log(
	by: FeedActor,
	game: Game,
	fields: Partial<RespawnLogRecord> = {},
	extra: Partial<HydratedFeedItem> = {},
) {
	return item('log', by, {
		game,
		log: {
			url: `/${by.handle ?? by.did}/game/${game.slug}/`,
			author: by,
			record: record(game, fields),
		},
		...extra,
	})
}

const REVIEW = { review: { text: 'An astonishing little universe.' } }

function logLike(
	by: FeedActor,
	author: FeedActor,
	game: Game,
	extra: Partial<HydratedFeedItem> = {},
) {
	return item('logLike', by, {
		game,
		log: {
			url: `/${author.handle ?? author.did}/game/${game.slug}/`,
			author,
			record: record(game, { ...REVIEW, rating: 9 }),
		},
		...extra,
	})
}

interface Variant {
	label: string
	item: HydratedFeedItem
}

interface Section {
	id: string
	title: string
	note?: string
	variants: Variant[]
}

const FINISHED: PlayedState[] = ['played', 'completed', 'retired', 'shelved', 'abandoned']

const sections: Section[] = [
	{
		id: 'log-verbs',
		title: 'Log — verbs',
		note: 'From activityVerb(): started + finished beats started, beats finished, beats review, beats rating, beats “logged”.',
		variants: [
			{ label: 'empty log', item: log(alex, games.outerWilds) },
			{ label: 'rating only', item: log(alex, games.outerWilds, { rating: 8 }) },
			{ label: 'review only', item: log(alex, games.outerWilds, REVIEW) },
			{
				label: 'external review only',
				item: log(alex, games.outerWilds, {
					review: { text: '', external: { uri: 'at://did:plc:alex/site.standard.document/1' } },
				}),
			},
			{ label: 'review + rating', item: log(alex, games.outerWilds, { ...REVIEW, rating: 10 }) },
			{ label: 'startedPlaying', item: log(sam, games.hades, { startedPlaying: true }) },
			{
				label: 'startedPlaying + rating + review',
				item: log(sam, games.hades, { startedPlaying: true, rating: 7, ...REVIEW }),
			},
			...FINISHED.map((state) => ({
				label: `finished: ${state}`,
				item: log(jordan, games.eldenRing, { finishedPlaying: state }),
			})),
			...FINISHED.map((state) => ({
				label: `started + finished: ${state}`,
				item: log(jordan, games.celeste, { startedPlaying: true, finishedPlaying: state }),
			})),
			{
				label: 'finished: completed + rating',
				item: log(jordan, games.eldenRing, { finishedPlaying: 'completed', rating: 9 }),
			},
			{
				label: 'finished: abandoned + low rating + review',
				item: log(jordan, games.eldenRing, { finishedPlaying: 'abandoned', rating: 3, ...REVIEW }),
			},
		],
	},
	{
		id: 'log-ratings',
		title: 'Log — ratings',
		note: 'Records store 1–10; stars are value / 2.',
		variants: [1, 2, 3, 5, 6, 9, 10].map((rating) => ({
			label: `rating ${rating} (${rating / 2}★)`,
			item: log(sam, games.stardew, { rating }),
		})),
	},
	{
		id: 'log-actors',
		title: 'Log — actors',
		variants: [
			{ label: 'viewer, started', item: log(viewer, games.disco, { startedPlaying: true }) },
			{
				label: 'viewer, completed + rating',
				item: log(viewer, games.disco, { finishedPlaying: 'completed', rating: 10 }),
			},
			{ label: 'viewer, logged', item: log(viewer, games.disco) },
			{ label: 'no avatar', item: log(noAvatar, games.disco, { rating: 6 }) },
			{ label: 'no display name (handle)', item: log(handleOnly, games.disco, { rating: 6 }) },
			{ label: 'no handle (DID)', item: log(didOnly, games.disco, { rating: 6 }) },
			{
				label: 'long name + long title + rating',
				item: log(longName, games.longTitle, {
					startedPlaying: true,
					finishedPlaying: 'shelved',
					rating: 5,
				}),
			},
		],
	},
	{
		id: 'log-like',
		title: 'Log like',
		note: 'Only a log with a review can be liked.',
		variants: [
			{ label: 'other likes other', item: logLike(alex, sam, games.hades) },
			{ label: 'other likes viewer', item: logLike(alex, viewer, games.hades) },
			{ label: 'viewer likes other', item: logLike(viewer, jordan, games.eldenRing) },
			{ label: 'viewer likes own', item: logLike(viewer, viewer, games.eldenRing) },
			{ label: 'other likes own', item: logLike(sam, sam, games.celeste) },
			{ label: 'author has no display name', item: logLike(alex, handleOnly, games.celeste) },
			{ label: 'author has no handle', item: logLike(alex, didOnly, games.celeste) },
			{ label: 'long names + long title', item: logLike(longName, longName, games.longTitle) },
		],
	},
	{
		id: 'backlog',
		title: 'Backlog add',
		note: 'Possessive comes from the actor’s pronouns; unknown or missing → “their”.',
		variants: [
			{ label: 'they/their', item: backlog(alex) },
			{ label: 'she/her', item: backlog(sam) },
			{ label: 'he/his', item: backlog(jordan) },
			{ label: 'he/their', item: backlog(longName, games.stardew) },
			{ label: 'xe/xyr', item: backlog(actor('did:plc:xe', 'xe.social', 'Kai', 'xe/xyr')) },
			{ label: 'ze/hir', item: backlog(actor('did:plc:ze', 'ze.social', 'Robin', 'ze/hir')) },
			{ label: 'it/its', item: backlog(actor('did:plc:it', 'it.social', 'GLaDOS', 'it/its')) },
			{
				label: 'unlisted value “any”',
				item: backlog(actor('did:plc:any', 'any.social', 'Morgan', 'any')),
			},
			{ label: 'no profile (null)', item: backlog(noAvatar) },
			{ label: 'viewer', item: backlog(viewer, games.celeste) },
			{ label: 'no display name (handle)', item: backlog(handleOnly) },
			{ label: 'no handle (DID)', item: backlog(didOnly) },
			{ label: 'long name + long title', item: backlog(longName, games.longTitle) },
		],
	},
	{
		id: 'follow',
		title: 'Follow',
		variants: [
			{ label: 'other follows other', item: follow(alex, sam) },
			{ label: 'other follows viewer', item: follow(jordan, viewer) },
			{ label: 'viewer follows other', item: follow(viewer, sam) },
			{ label: 'no avatar', item: follow(noAvatar, alex) },
			{ label: 'handle-only subject', item: follow(alex, handleOnly) },
			{ label: 'DID-only actor', item: follow(didOnly, sam) },
			{ label: 'long names', item: follow(longName, longName) },
		],
	},
	{
		id: 'timestamps',
		title: 'Timestamps',
		variants: [
			...(
				[
					['just now', 20_000],
					['minutes', 5 * MINUTE],
					['hours', 3 * HOUR],
					['days', 2 * DAY],
					['months', 210 * DAY],
					['years', 400 * DAY],
				] as const
			).map(([label, ms]) => ({
				label,
				item: log(alex, games.celeste, { rating: 8 }, { createdAt: ago(ms) }),
			})),
			{
				label: 'none (optimistic)',
				item: log(viewer, games.celeste, { startedPlaying: true }, { createdAt: undefined }),
			},
		],
	},
]

const mixed: HydratedFeed = {
	items: [
		log(alex, games.outerWilds, { startedPlaying: true, finishedPlaying: 'completed', rating: 10 }),
		logLike(sam, viewer, games.disco),
		follow(jordan, viewer),
		backlog(sam, games.eldenRing),
		log(viewer, games.hades, { startedPlaying: true }),
		log(jordan, games.celeste, { ...REVIEW, rating: 7 }),
		follow(alex, jordan),
		log(sam, games.stardew, { finishedPlaying: 'shelved' }),
		backlog(viewer, games.outerWilds),
		logLike(viewer, alex, games.outerWilds),
	].map((entry, index) => Object.assign(entry, { createdAt: ago((index + 1) ** 2 * 23 * MINUTE) })),
	cursor: 'demo',
}

function single(entry: HydratedFeedItem): HydratedFeed {
	return { items: [entry], cursor: null }
}

const empty: HydratedFeed = { items: [], cursor: null }
</script>

<svelte:head>
	<title>Activity feed demo — Respawn</title>
</svelte:head>

<article class="page">
	<header class="intro">
		<h1 class="heading">Activity feed</h1>
		<p class="copy secondary">
			Fixture items rendered through <code>ActivityFeed</code>. Viewer rows match
			<strong>{viewer.displayName ?? viewer.handle ?? viewer.did}</strong>{page.data.user?.did ===
			'did:plc:demoviewer'
				? ' (a stand-in, since you’re signed out)'
				: ''}.
		</p>
		<nav class="toc">
			<a href="#mixed">Mixed</a>
			{#each sections as section (section.id)}
				<a href="#{section.id}">{section.title}</a>
			{/each}
			<a href="#states">Feed states</a>
		</nav>
	</header>

	<section class="demo" id="mixed">
		<h2 class="label">Mixed feed</h2>
		<div class="frame">
			<ActivityFeed feed={mixed} appviewConfigured feedError={false} emptyText="" />
		</div>
	</section>

	{#each sections as section (section.id)}
		<section class="demo" id={section.id}>
			<h2 class="label">{section.title}</h2>
			{#if section.note}
				<p class="copy sm secondary">{section.note}</p>
			{/if}
			<dl class="variants">
				{#each section.variants as variant (variant.item.uri)}
					<dt class="variant-label">{variant.label}</dt>
					<dd class="variant-row">
						<ActivityFeed
							feed={single(variant.item)}
							appviewConfigured
							feedError={false}
							emptyText=""
						/>
					</dd>
				{/each}
			</dl>
		</section>
	{/each}

	<section class="demo" id="states">
		<h2 class="label">Feed states</h2>
		<dl class="variants">
			<dt class="variant-label">empty</dt>
			<dd class="variant-row">
				<ActivityFeed
					feed={empty}
					appviewConfigured
					feedError={false}
					emptyText="Nothing here yet — follow people from their profile pages and their activity will show up."
				/>
			</dd>
			<dt class="variant-label">error</dt>
			<dd class="variant-row">
				<ActivityFeed feed={null} appviewConfigured feedError emptyText="" />
			</dd>
			<dt class="variant-label">not configured</dt>
			<dd class="variant-row">
				<ActivityFeed feed={null} appviewConfigured={false} feedError={false} emptyText="" />
			</dd>
		</dl>
	</section>
</article>

<style>
.intro,
.demo {
	display: grid;
	gap: 12px;
}

.demo {
	scroll-margin-block-start: 24px;
}

.toc {
	display: flex;
	flex-wrap: wrap;
	gap: 8px 16px;
	font-size: 0.8125rem;

	a {
		color: var(--color-grey-300);

		&:hover {
			color: var(--color-grey-100);
		}
	}
}

.frame {
	padding: 4px 12px;
	border: 1px solid var(--color-grey-700);
	border-radius: 8px;

	@supports (corner-shape: squircle) {
		border-radius: 16px;
		corner-shape: var(--corner-shape);
	}
}

.variants {
	display: grid;
	grid-template-columns: minmax(10rem, 14rem) 1fr;
	gap: 0 16px;
	align-items: center;
	margin: 0;

	@media (width < 640px) {
		grid-template-columns: 1fr;
	}
}

.variant-label {
	font-family: var(--font-mono, ui-monospace, monospace);
	font-size: 0.75rem;
	color: var(--color-grey-500);

	@media (width < 640px) {
		padding-block-start: 12px;
	}
}

.variant-row {
	min-inline-size: 0;
	margin: 0;
	border-block-end: 1px solid color-mix(in srgb, var(--color-grey-500) 40%, transparent);

	:global(.feed) {
		margin: 0;
	}
}

code {
	font-size: 0.875em;
	color: var(--color-grey-100);
}
</style>
