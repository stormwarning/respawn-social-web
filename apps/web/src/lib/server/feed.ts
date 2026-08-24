import { Collections } from '@respawn-social/lexicons'
import type { FeedItem, FeedPage } from '$lib/server/appview'
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
}

export interface HydratedFeed {
	items: HydratedFeedItem[]
	cursor: string | null
}

/**
 * HappyView returns raw records, so author identity and cover URLs are filled in
 * here. Handles and PDS endpoints come from the memoized resolvers; a lookup
 * that fails leaves the DID showing rather than dropping the row.
 */
export async function hydrateFeed(page: FeedPage): Promise<HydratedFeed> {
	const dids = new Set<string>()
	for (const item of page.feed) {
		dids.add(item.did)
		if (item.subject) dids.add(item.subject)
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
		items: page.feed.map((item) => ({
			type: item.type,
			uri: item.uri,
			createdAt: item.createdAt,
			actor: actorFor(item.did),
			game: item.game ?? null,
			coverUrl: blobUrl(pdsByDid.get(item.did), item.did, item.cover?.image),
			subject: item.subject ? actorFor(item.subject) : null,
		})),
	}
}
