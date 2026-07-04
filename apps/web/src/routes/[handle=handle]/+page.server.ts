import { error, fail, redirect } from '@sveltejs/kit'
import { Collections } from '@respawn-social/lexicons'
import type { Actions, PageServerLoad } from './$types'
import { avatarUrlForBlob, type RespawnProfileRecord } from '$lib/atproto/profile'
import { findFollow, follow, unfollow } from '$lib/atproto/graph'
import { getRecordOrNull, listAllRecords } from '$lib/atproto/records'
import { listLogs } from '$lib/atproto/log'
import { publicAgent, resolveActor } from '$lib/atproto/public'
import { listLists } from '$lib/atproto/list'
import { loadBacklog } from '$lib/atproto/backlog'
import type { RespawnGameRecord } from '$lib/atproto/game'

export const load: PageServerLoad = async ({ params, locals }) => {
	let actor
	try {
		actor = await resolveActor(params.handle)
	} catch {
		error(404, 'Account not found')
	}
	const repo = publicAgent(actor.pds)

	const [profile, logs, lists, backlog, games] = await Promise.all([
		getRecordOrNull<RespawnProfileRecord>(repo, actor.did, Collections.profile, 'self'),
		listLogs(repo, actor.did),
		listLists(repo, actor.did),
		loadBacklog(repo, actor.did),
		listAllRecords<RespawnGameRecord>(repo, actor.did, Collections.game),
	])

	// 1-based chronological log number per game, for /[handle]/game/[slug]/[n] links.
	const logNumbers = new Map<string, number>()
	const perGameSeen = new Map<string, number>()
	for (const log of logs.toReversed()) {
		const n = (perGameSeen.get(log.value.game.slug) ?? 0) + 1
		perGameSeen.set(log.value.game.slug, n)
		logNumbers.set(log.uri, n)
	}

	const isSelf = locals.user?.did === actor.did
	let followUri: string | null = null
	if (locals.user && locals.agent && !isSelf) {
		followUri = (await findFollow(locals.agent, locals.user.did, actor.did))?.uri ?? null
	}

	return {
		handle: actor.handle ?? actor.did,
		did: actor.did,
		profile: profile?.value ?? null,
		avatarUrl: avatarUrlForBlob(actor.pds, actor.did, profile?.value.avatar),
		recentLogs: logs.slice(0, 10).map((log) => ({
			uri: log.uri,
			game: log.value.game,
			rating: log.value.rating ?? null,
			liked: log.value.liked ?? false,
			finishedPlaying: log.value.finishedPlaying ?? null,
			createdAt: log.value.createdAt,
			n: logNumbers.get(log.uri) ?? 1,
			hasReview: Boolean(log.value.review?.text),
		})),
		logCount: logs.length,
		gameCount: games.length,
		lists: lists.map((list) => ({
			slug: list.value.slug,
			name: list.value.name,
			itemCount: list.value.items?.length ?? 0,
		})),
		backlogCount: backlog?.games.length ?? 0,
		isSelf,
		isLoggedIn: !!locals.user,
		followUri,
	}
}

export const actions: Actions = {
	follow: async ({ params, locals }) => {
		if (!locals.user || !locals.agent) redirect(303, '/login')
		try {
			const actor = await resolveActor(params.handle)
			if (actor.did === locals.user.did) return fail(400, { error: 'You cannot follow yourself.' })
			const existing = await findFollow(locals.agent, locals.user.did, actor.did)
			if (!existing) await follow(locals.agent, locals.user.did, actor.did)
			return { following: true }
		} catch (err) {
			console.error('[handle] follow failed', err)
			return fail(500, { error: 'Could not follow. Try again.' })
		}
	},
	unfollow: async ({ params, locals }) => {
		if (!locals.user || !locals.agent) redirect(303, '/login')
		try {
			const actor = await resolveActor(params.handle)
			const existing = await findFollow(locals.agent, locals.user.did, actor.did)
			if (existing) await unfollow(locals.agent, locals.user.did, existing.rkey)
			return { following: false }
		} catch (err) {
			console.error('[handle] unfollow failed', err)
			return fail(500, { error: 'Could not unfollow. Try again.' })
		}
	},
}
