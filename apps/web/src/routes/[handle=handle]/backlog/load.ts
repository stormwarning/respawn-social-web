import { error, type RequestEvent } from '@sveltejs/kit'
import { Collections } from '@respawn-social/lexicons'
import { cachePageData } from '$lib/server/page-cache'
import { avatarUrlForBlob, blobUrl, type RespawnProfileRecord } from '$lib/atproto/profile'
import { getRecordOrNull } from '$lib/atproto/records'
import { loadBacklog, migrateLegacyBacklog } from '$lib/atproto/backlog'
import { publicAgent, resolveActor } from '$lib/atproto/public'

export const PAGE_SIZE = 24

/**
 * Backlog items are listed in full, so paging is a slice here rather than a
 * cursor fetch — the total is always known up front.
 */
export async function loadBacklogPage(
	handle: string,
	page: number,
	locals: App.Locals,
	setHeaders: RequestEvent['setHeaders'],
) {
	let actor
	try {
		actor = await resolveActor(handle)
	} catch {
		error(404, 'Account not found')
	}
	const repo = publicAgent(actor.pds)
	const isSelf = locals.user?.did === actor.did

	if (isSelf && locals.agent) await migrateLegacyBacklog(locals.agent, actor.did)

	const [profile, games] = await Promise.all([
		getRecordOrNull<RespawnProfileRecord>(repo, actor.did, Collections.profile, 'self'),
		loadBacklog(repo, actor.did),
	])

	const totalPages = Math.max(1, Math.ceil(games.length / PAGE_SIZE))
	if (page > totalPages) error(404, 'Page not found')
	const start = (page - 1) * PAGE_SIZE

	// Only this actor can add to their own backlog, so another viewer's copy of
	// the page can't go stale under them.
	cachePageData(setHeaders, { viewerCanMutate: isSelf })

	return {
		handle: actor.handle ?? actor.did,
		displayName: profile?.value.displayName || (actor.handle ?? actor.did),
		avatarUrl: avatarUrlForBlob(actor.pds, actor.did, profile?.value.avatar),
		isSelf,
		page,
		totalPages,
		total: games.length,
		items: games.slice(start, start + PAGE_SIZE).map((item) => ({
			igdbId: item.game.igdbId,
			slug: item.game.slug,
			title: item.game.title,
			releaseDate: item.releaseDate ?? null,
			coverUrl: blobUrl(actor.pds, actor.did, item.cover?.image),
		})),
	}
}
