import { error } from '@sveltejs/kit'
import { Collections } from '@respawn-social/lexicons'
import { blobUrl, type RespawnProfileRecord } from '$lib/atproto/profile'
import { getRecordOrNull } from '$lib/atproto/records'
import { loadBacklog } from '$lib/atproto/backlog'
import { publicAgent, resolveActor } from '$lib/atproto/public'

export const PAGE_SIZE = 24

/**
 * The backlog is one record holding the whole list, so paging is a slice here
 * rather than a cursor fetch — the total is always known up front.
 */
export async function loadBacklogPage(handle: string, page: number, locals: App.Locals) {
	let actor
	try {
		actor = await resolveActor(handle)
	} catch {
		error(404, 'Account not found')
	}
	const repo = publicAgent(actor.pds)

	const [profile, backlog] = await Promise.all([
		getRecordOrNull<RespawnProfileRecord>(repo, actor.did, Collections.profile, 'self'),
		loadBacklog(repo, actor.did),
	])

	const games = (backlog?.games ?? []).toReversed()
	const totalPages = Math.max(1, Math.ceil(games.length / PAGE_SIZE))
	if (page > totalPages) error(404, 'Page not found')
	const start = (page - 1) * PAGE_SIZE

	return {
		handle: actor.handle ?? actor.did,
		displayName: profile?.value.displayName || (actor.handle ?? actor.did),
		isSelf: locals.user?.did === actor.did,
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
