import { Collections } from '@respawn-social/lexicons'
import type { FeedItem, FeedLogView, FeedPage } from '$lib/server/appview'
import { resolveIds } from '$lib/server/backend'
import type { ResolveResult } from '$lib/types/game'
import type { RespawnLogRecord } from '$lib/atproto/log'
import { resolveHandleForDid, resolvePdsEndpoint } from '$lib/atproto/identity'
import { publicAgent } from '$lib/atproto/public'
import { getRecordOrNull } from '$lib/atproto/records'
import { blobUrl, type RespawnProfileRecord } from '$lib/atproto/profile'
import type { AtprotoDid, Did } from '@atcute/lexicons/syntax'

export interface FeedActor {
	did: string
	handle: string | null
	displayName: string | null
	/** Raw lexicon value, e.g. "she/her"; null when the profile didn't load. */
	pronouns: string | null
	avatarUrl: string | null
}

export interface HydratedFeedItem {
	type: FeedItem['type']
	uri: string
	createdAt: string
	actor: FeedActor
	game: { igdbId: number; slug: string; title: string } | null
	coverUrl: string | null
	subject: FeedActor | null
	/** Set on log (the log itself) and logLike (the log liked). */
	log: FeedLog | null
}

export interface FeedLog {
	/** The log's page. */
	url: string
	author: FeedActor
	record: RespawnLogRecord
}

export interface HydratedFeed {
	items: HydratedFeedItem[]
	cursor: string | null
}

/**
 * Whether a game is still unreleased, so feed rows about logging it wait.
 *
 * A resolved title with no date is TBA and waits too. An id the backend never
 * mirrored, or a backend too old to send dates, has nothing to wait on.
 */
export function isUnreleased(result: ResolveResult | undefined, now: Date): boolean {
	if (!result || result.titleId === null || result.firstReleaseDate === undefined) return false
	if (result.firstReleaseDate === null) return true
	return new Date(result.firstReleaseDate) > now
}

/**
 * Drop log and logLike rows whose game isn't out yet. Checked fresh on every
 * read, against the backend rather than anything stored on the log, because
 * release dates slip. The rows reappear in place once the game ships.
 */
async function withoutUnreleased(items: FeedItem[], fetchFn?: typeof fetch): Promise<FeedItem[]> {
	const ids = items.flatMap((item) => (item.log && item.game ? [item.game.igdbId] : []))
	if (ids.length === 0) return items

	let resolved: Record<string, ResolveResult>
	try {
		resolved = await resolveIds(ids, fetchFn)
	} catch (err) {
		// A backend outage shouldn't empty the feed; an early log is the lesser harm.
		console.error('[feed] release check failed:', err)
		return items
	}
	const now = new Date()
	return items.filter(
		(item) => !(item.log && item.game && isUnreleased(resolved[item.game.igdbId], now)),
	)
}

/** `/[handle]/game/[slug]/[n]/`, with the first log at the bare game path. */
export function logPath(actor: string, slug: string, n: number): string {
	return `/${actor}/game/${slug}/${n > 1 ? `${n}/` : ''}`
}

/**
 * HappyView returns raw records, so author identity and cover URLs are filled in
 * here. Handles and PDS endpoints come from the memoized resolvers; a lookup
 * that fails leaves the DID showing rather than dropping the row.
 *
 * Rows for unreleased games are dropped, so a page can come back shorter than
 * asked for; the cursor still comes from the appview, so paging carries on.
 */
export async function hydrateFeed(page: FeedPage, fetchFn?: typeof fetch): Promise<HydratedFeed> {
	const feed = await withoutUnreleased(page.feed, fetchFn)

	const dids = new Set<string>()
	for (const item of feed) {
		dids.add(item.did)
		if (item.subject) dids.add(item.subject)
		if (item.log) dids.add(item.log.did)
	}

	const actors = new Map<string, FeedActor>()
	const pdsByDid = new Map<string, string | undefined>()
	await Promise.all(
		[...dids].map(async (did) => {
			const [handle, pds] = await Promise.all([
				resolveHandleForDid(did).catch(() => null),
				resolvePdsEndpoint(did as Did | AtprotoDid).catch(() => undefined),
			])
			pdsByDid.set(did, pds)
			let displayName: string | null = null
			let pronouns: string | null = null
			let avatarUrl: string | null = null
			if (pds) {
				const profile = await getRecordOrNull<RespawnProfileRecord>(
					publicAgent(pds),
					did,
					Collections.profile,
					'self',
				).catch(() => null)
				displayName = profile?.value.displayName || null
				pronouns = profile?.value.pronouns || null
				avatarUrl = blobUrl(pds, did, profile?.value.avatar)
			}
			actors.set(did, { did, handle, displayName, pronouns, avatarUrl })
		}),
	)

	const actorFor = (did: string): FeedActor =>
		actors.get(did) ?? { did, handle: null, displayName: null, pronouns: null, avatarUrl: null }

	return {
		cursor: page.cursor,
		items: feed.map((item) => ({
			type: item.type,
			uri: item.uri,
			createdAt: item.createdAt,
			actor: actorFor(item.did),
			game: item.game ?? null,
			coverUrl: blobUrl(pdsByDid.get(item.did), item.did, item.cover?.image),
			subject: item.subject ? actorFor(item.subject) : null,
			log: item.log ? hydrateLog(item.log, actorFor(item.log.did)) : null,
		})),
	}
}

function hydrateLog(log: FeedLogView, author: FeedActor): FeedLog {
	return {
		url: logPath(author.handle ?? author.did, log.record.game.slug, log.number),
		author,
		record: log.record,
	}
}
