import { error, type RequestEvent } from '@sveltejs/kit'
import { Collections } from '@respawn-social/lexicons'
import { cachePageData } from '$lib/server/page-cache'
import { avatarUrlForBlob, blobUrl, type RespawnProfileRecord } from '$lib/atproto/profile'
import { listAllRecords, getRecordOrNull, type RecordEnvelope } from '$lib/atproto/records'
import { listLogs } from '$lib/atproto/log'
import { loadBacklog } from '$lib/atproto/backlog'
import { publicAgent, resolveActor } from '$lib/atproto/public'
import type { GameRef, RespawnGameRecord } from '$lib/atproto/game'

export const PAGE_SIZE = 24

export async function loadGamesPage(
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

	const [profile, games, logs, backlog] = await Promise.all([
		getRecordOrNull<RespawnProfileRecord>(repo, actor.did, Collections.profile, 'self'),
		listAllRecords<RespawnGameRecord>(repo, actor.did, Collections.game),
		listLogs(repo, actor.did),
		loadBacklog(repo, actor.did),
	])

	// Game records only carried a title from mid-2026 on. For older ones, borrow
	// the ref off any other record that names the same game.
	const refs = new Map<number, GameRef>()
	for (const item of backlog) refs.set(item.game.igdbId, item.game)
	for (const fave of profile?.value.faves ?? []) refs.set(fave.game.igdbId, fave.game)
	for (const log of logs) refs.set(log.value.game.igdbId, log.value.game)

	// Newest log wins; games never logged fall back to when the record was made.
	const lastPlayed = new Map<number, string>()
	for (const log of logs) {
		const id = log.value.game.igdbId
		const at = log.value.createdAt
		if (at > (lastPlayed.get(id) ?? '')) lastPlayed.set(id, at)
	}

	const entries = games
		.map((rec) => toEntry(rec, refs, lastPlayed, actor.pds, actor.did))
		.filter((entry) => entry !== null)
		.toSorted((a, b) => (a.sortedAt < b.sortedAt ? 1 : -1))

	const playing = entries.filter((entry) => entry.playing)
	const played = entries.filter((entry) => entry.played != null)

	const totalPages = Math.max(1, Math.ceil(played.length / PAGE_SIZE))
	if (page > totalPages) error(404, 'Page not found')
	const start = (page - 1) * PAGE_SIZE

	// Only this actor can write to their own repo, so another viewer's copy of the
	// page can't go stale under them.
	cachePageData(setHeaders, { viewerCanMutate: isSelf })

	return {
		handle: actor.handle ?? actor.did,
		displayName: profile?.value.displayName || (actor.handle ?? actor.did),
		avatarUrl: avatarUrlForBlob(actor.pds, actor.did, profile?.value.avatar),
		isSelf,
		page,
		totalPages,
		// The playing list isn't paginated, so repeating it under every page of
		// played games would just be noise.
		playing: page === 1 ? playing.map(toItem) : [],
		played: played.slice(start, start + PAGE_SIZE).map(toItem),
		playedTotal: played.length,
	}
}

interface Entry extends GameRef {
	coverUrl: string | null
	playing: boolean
	played?: string
	sortedAt: string
}

function toEntry(
	rec: RecordEnvelope<RespawnGameRecord>,
	refs: Map<number, GameRef>,
	lastPlayed: Map<number, string>,
	pds: string | undefined,
	did: string,
): Entry | null {
	const igdbId = Number(rec.rkey)
	if (!Number.isInteger(igdbId) || igdbId < 1) return null

	// Nothing to label or link the game with; it self-heals once the game is
	// next touched, since every writer backfills the ref.
	const ref = rec.value.game ?? refs.get(igdbId)
	if (!ref) return null

	return {
		...ref,
		coverUrl: blobUrl(pds, did, rec.value.cover?.image),
		playing: rec.value.playing === true,
		played: rec.value.played,
		sortedAt: lastPlayed.get(igdbId) ?? rec.value.createdAt,
	}
}

const toItem = ({ igdbId, slug, title, coverUrl, played }: Entry) => ({
	igdbId,
	slug,
	title,
	coverUrl,
	played: played ?? null,
})
