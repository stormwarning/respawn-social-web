import { error, fail, redirect } from '@sveltejs/kit'
import { Collections } from '@respawn-social/lexicons'
import type { Actions, PageServerLoad } from './$types'
import { createComment } from '$lib/atproto/comment'
import { createLike, deleteLike, findLike } from '$lib/atproto/like'
import { getRecordOrNull, toPlainRecord } from '$lib/atproto/records'
import { hasReview, listLogs, type RespawnReplygateRecord } from '$lib/atproto/log'
import { avatarUrlForBlob, type RespawnProfileRecord } from '$lib/atproto/profile'
import { getBlobUrl, resolveLogMedia, visiblePhotos } from '$lib/atproto/grain'
import { publicAgent, resolveActor } from '$lib/atproto/public'
import { cachePageData } from '$lib/server/page-cache'

const MAX_COMMENT_LENGTH = 3000

/** The nth (1-based, chronological) log this actor wrote for this game. */
async function loadLog(handle: string, slug: string, n: number) {
	const actor = await resolveActor(handle)
	const repo = publicAgent(actor.pds)
	// listLogs returns newest first; flip for chronological numbering.
	const logs = (await listLogs(repo, actor.did, { slug })).toReversed()
	const log = logs[n - 1]
	return { actor, repo, log: log ?? null, total: logs.length }
}

export const load: PageServerLoad = async ({ params, locals, setHeaders }) => {
	const n = params.n ? Number(params.n) : 1

	let loaded
	try {
		loaded = await loadLog(params.handle, params.slug, n)
	} catch {
		error(404, 'Account not found')
	}
	const { actor, repo, log, total } = loaded
	if (!log) error(404, 'Log not found')

	// Replygate record shares the log's rkey. Enforcement is advisory until
	// HappyView can apply it on read.
	const { agent, user } = locals
	const handle = actor.handle ?? actor.did
	const media = log.value.media ?? []
	const [profile, replygate, viewerLike, photos] = await Promise.all([
		getRecordOrNull<RespawnProfileRecord>(repo, actor.did, Collections.profile, 'self'),
		getRecordOrNull<RespawnReplygateRecord>(repo, actor.did, Collections.replygate, log.rkey),
		user && agent ? findLike(agent, user.did, log.uri) : null,
		// Checked against Grain as it is now: deleted photos drop out, edited ones show as edited.
		media.length
			? resolveLogMedia(
					repo,
					{ did: actor.did, handle, blobUrl: getBlobUrl(actor.pds, actor.did) },
					media,
				)
					.then(visiblePhotos)
					.catch((err) => {
						console.error('[log] grain media failed', err)
						return []
					})
			: [],
	])
	// Absent `allow` means anyone; `[]` means no one; otherwise a union of rules.
	const allow = replygate?.value.allow
	const commentsClosed = allow?.length === 0
	const commentsLimited = Boolean(allow?.length)

	const isSelf = user?.did === actor.did

	// A signed-in viewer can like or comment from here, and the like state is part
	// of this payload, so only the logged-out view is safe to hold. Set only once
	// the load has succeeded, so a resolve failure — which surfaces as a 404 —
	// isn't held for a minute.
	cachePageData(setHeaders, { viewerCanMutate: Boolean(locals.user) })

	return {
		handle,
		displayName: profile?.value.displayName || handle,
		avatarUrl: avatarUrlForBlob(actor.pds, actor.did, profile?.value.avatar),
		log: toPlainRecord(log.value),
		photos,
		logUri: log.uri,
		logCid: log.cid,
		n,
		total,
		// Only a review can be liked or commented on.
		interactive: hasReview(log.value),
		commentsClosed,
		commentsLimited,
		isSelf,
		isLoggedIn: !!user,
		// Whether the viewer liked this log, not `log.liked` (the author liking the game).
		viewerLiked: viewerLike !== null,
	}
}

export const actions: Actions = {
	like: async ({ params, locals, request }) => {
		if (!locals.user || !locals.agent) redirect(303, '/login')
		const { agent, user } = locals
		// The button has already flipped, so it sends the state it wants rather than
		// asking for a toggle: rapid taps then settle on the last one, not on parity.
		const liked = (await request.formData()).get('liked') === 'true'
		try {
			const { log } = await loadLog(params.handle, params.slug, params.n ? Number(params.n) : 1)
			if (!log) return fail(404, { error: 'Log not found.' })
			// Unliking stays open, so a like left behind by a removed review can go.
			if (liked && !hasReview(log.value)) {
				return fail(400, { error: 'Only a log with a review can be liked.' })
			}
			const existing = await findLike(agent, user.did, log.uri)
			if (liked && !existing) await createLike(agent, user.did, { uri: log.uri, cid: log.cid })
			if (!liked && existing) await deleteLike(agent, user.did, existing.rkey)
			return { liked }
		} catch (err) {
			console.error('[log] like failed', err)
			return fail(500, { error: 'Could not update like. Try again.' })
		}
	},
	comment: async ({ params, locals, request }) => {
		if (!locals.user || !locals.agent) redirect(303, '/login')
		const { agent, user } = locals

		const form = await request.formData()
		const text = String(form.get('text') ?? '').trim()
		if (!text) return fail(400, { error: 'Comment cannot be empty.' })
		if (text.length > MAX_COMMENT_LENGTH) return fail(400, { error: 'Comment is too long.' })

		try {
			const { log } = await loadLog(params.handle, params.slug, params.n ? Number(params.n) : 1)
			if (!log) return fail(404, { error: 'Log not found.' })
			if (!hasReview(log.value)) {
				return fail(400, { error: 'Only a log with a review can be commented on.' })
			}
			await createComment(agent, user.did, {
				text,
				subject: { uri: log.uri, cid: log.cid },
			})
			return { commented: true }
		} catch (err) {
			console.error('[log] comment failed', err)
			return fail(500, { error: 'Could not post comment. Try again.' })
		}
	},
}
