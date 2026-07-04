import { error, fail, redirect } from '@sveltejs/kit'
import { Collections } from '@respawn-social/lexicons'
import type { Actions, PageServerLoad } from './$types'
import { createComment } from '$lib/atproto/comment'
import { createLike, deleteLike, findLike } from '$lib/atproto/like'
import { getRecordOrNull } from '$lib/atproto/records'
import { listLogs, type RespawnGateRecord } from '$lib/atproto/log'
import { publicAgent, resolveActor } from '$lib/atproto/public'

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

export const load: PageServerLoad = async ({ params, locals }) => {
	const n = params.n ? Number(params.n) : 1

	let loaded
	try {
		loaded = await loadLog(params.handle, params.slug, n)
	} catch {
		error(404, 'Account not found')
	}
	const { actor, repo, log, total } = loaded
	if (!log) error(404, 'Log not found')

	// Gate record shares the log's rkey. Enforcement is advisory until the appview.
	const gate = await getRecordOrNull<RespawnGateRecord>(repo, actor.did, Collections.gate, log.rkey)
	const allow = gate?.value.allow
	const commentsClosed =
		allow != null && (allow.length === 0 || allow.some((r) => r.$type?.endsWith('#nobodyRule')))
	const likesDisabled = Boolean(gate?.value.disableLikes)

	const isSelf = locals.user?.did === actor.did
	let viewerLike: { rkey: string } | null = null
	if (locals.user && locals.agent && !likesDisabled) {
		const like = await findLike(locals.agent, locals.user.did, log.uri)
		viewerLike = like ? { rkey: like.rkey } : null
	}

	return {
		handle: actor.handle ?? actor.did,
		log: log.value,
		logUri: log.uri,
		logCid: log.cid,
		n,
		total,
		commentsClosed,
		likesDisabled,
		isSelf,
		isLoggedIn: !!locals.user,
		liked: viewerLike !== null,
	}
}

export const actions: Actions = {
	like: async ({ params, locals }) => {
		if (!locals.user || !locals.agent) redirect(303, '/login')
		const { agent, user } = locals
		try {
			const { log } = await loadLog(params.handle, params.slug, params.n ? Number(params.n) : 1)
			if (!log) return fail(404, { error: 'Log not found.' })
			const existing = await findLike(agent, user.did, log.uri)
			if (existing) {
				await deleteLike(agent, user.did, existing.rkey)
				return { liked: false }
			}
			await createLike(agent, user.did, { uri: log.uri, cid: log.cid })
			return { liked: true }
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
