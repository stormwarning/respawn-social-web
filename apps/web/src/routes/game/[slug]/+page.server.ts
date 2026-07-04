import { error, fail, redirect } from '@sveltejs/kit'
import { getGameBySlug } from '$lib/server/backend'
import type { Actions, PageServerLoad } from './$types'
import { normalizeCoverUrl } from '$lib/server/igdb'
import {
	loadGameRecord,
	putGameRecord,
	type PlayedState,
	type RespawnGameRecord,
} from '$lib/atproto/game'
import { createLog, listLogs, type GateAllowRule, type RespawnLogRecord } from '$lib/atproto/log'
import { buildCover } from '$lib/server/cover'

const PLAY_STATES = new Set(['played', 'completed', 'abandoned', 'retired', 'shelved'])
const GATE_RULES = new Set(['nobody', 'following', 'followers'])

export const load: PageServerLoad = async ({ params, fetch, locals }) => {
	try {
		const game = await getGameBySlug(params.slug, fetch)

		const names = (flag: 'developer' | 'publisher') =>
			game.involved_companies
				?.filter((c) => c[flag])
				.map((c) => c.company?.name)
				.filter(Boolean)
				.join(', ')

		if (game.cover?.url) game.cover.url = normalizeCoverUrl(game.cover.url)

		game.developer = names('developer')
		game.publisher = names('publisher')

		let site = game.websites?.find((w) => w.type.id === 1)?.url

		let played = false
		let ownLogs: Array<{ n: number; createdAt: string; rating: number | null }> = []
		if (locals.user && locals.agent) {
			try {
				const [rec, logs] = await Promise.all([
					loadGameRecord(locals.agent, locals.user.did, game.id),
					listLogs(locals.agent, locals.user.did, { igdbId: game.id }),
				])
				played = rec?.played != null
				// listLogs is newest first; number chronologically.
				ownLogs = logs
					.map((log, i) => ({
						n: logs.length - i,
						createdAt: log.value.createdAt,
						rating: log.value.rating ?? null,
					}))
					.slice(0, 10)
			} catch (err) {
				console.error('[game/[slug]] played lookup failed', err)
			}
		}

		return {
			game,
			site,
			played,
			ownLogs,
			isLoggedIn: !!locals.user,
			viewerHandle: locals.user?.handle ?? locals.user?.did ?? null,
		}
	} catch (err) {
		console.error('[game/[slug]] load failed', err)
		error(404, 'Game not found')
	}
}

export const actions: Actions = {
	toggle: async ({ request, locals }) => {
		if (!locals.user || !locals.agent) redirect(303, '/login')
		const { agent, user } = locals

		const form = await request.formData()
		const igdbId = Number(form.get('igdbId'))
		if (!Number.isInteger(igdbId) || igdbId < 1) {
			return fail(400, { error: 'Invalid game id.' })
		}
		const coverUrl = String(form.get('coverUrl') ?? '')

		try {
			const existing = await loadGameRecord(agent, user.did, igdbId)

			// Already played → drop the played field but keep the record (cover survives).
			if (existing?.played != null) {
				const { played: _drop, ...rest } = existing
				await putGameRecord(agent, user.did, igdbId, rest)
				return { played: false }
			}

			// Mark played. Build the cover once, on first creation.
			const record: RespawnGameRecord = existing
				? { ...existing, played: 'played' }
				: { played: 'played', createdAt: new Date().toISOString() }

			if (!record.cover && coverUrl) {
				record.cover = await buildCover(agent, coverUrl)
			}

			await putGameRecord(agent, user.did, igdbId, record)
			return { played: true }
		} catch (err) {
			console.error('[game/[slug]] toggle failed', err)
			return fail(500, { error: 'Could not update. Try again.' })
		}
	},

	log: async ({ params, request, fetch, locals }) => {
		if (!locals.user || !locals.agent) redirect(303, '/login')
		const { agent, user } = locals

		const form = await request.formData()
		const platform = String(form.get('platform') ?? '').trim()
		const datePlayed = String(form.get('datePlayed') ?? '').trim()
		const finishedPlaying = String(form.get('finishedPlaying') ?? '')
		const ratingRaw = String(form.get('rating') ?? '').trim()
		const liked = form.get('liked') === 'on'
		const reviewText = String(form.get('review') ?? '').trim()
		const containsSpoilers = form.get('containsSpoilers') === 'on'
		const allowRule = String(form.get('allow') ?? 'everyone')
		const disableLikes = form.get('disableLikes') === 'on'

		if (finishedPlaying && !PLAY_STATES.has(finishedPlaying)) {
			return fail(400, { logError: 'Invalid play state.' })
		}
		const rating = ratingRaw ? Number(ratingRaw) : undefined
		if (rating != null && (!Number.isInteger(rating) || rating < 1 || rating > 10)) {
			return fail(400, { logError: 'Rating must be a whole number from 1 to 10.' })
		}
		if (allowRule !== 'everyone' && !GATE_RULES.has(allowRule)) {
			return fail(400, { logError: 'Invalid comment setting.' })
		}

		try {
			// Refetch the game server-side so the denormalized ref can't drift.
			const game = await getGameBySlug(params.slug, fetch)
			const createdAt = new Date().toISOString()

			const log: RespawnLogRecord = {
				game: { igdbId: game.id, slug: params.slug, title: game.name },
				platform: platform || undefined,
				datePlayed: datePlayed ? new Date(`${datePlayed}T00:00:00Z`).toISOString() : undefined,
				finishedPlaying: (finishedPlaying as PlayedState) || undefined,
				rating,
				liked: liked || undefined,
				review: reviewText
					? { text: reviewText, containsSpoilers: containsSpoilers || undefined }
					: undefined,
				createdAt,
			}

			// Denormalized current state on the game record, written atomically.
			const existing = await loadGameRecord(agent, user.did, game.id)
			const gameRecord: RespawnGameRecord = {
				...existing,
				rating: rating ?? existing?.rating,
				liked: liked || existing?.liked || undefined,
				played: (finishedPlaying as PlayedState) || existing?.played,
				playing: finishedPlaying ? undefined : existing?.playing,
				createdAt: existing?.createdAt ?? createdAt,
			}
			if (!gameRecord.cover && game.cover?.url) {
				try {
					gameRecord.cover = await buildCover(agent, game.cover.url)
				} catch (err) {
					console.error('[game/[slug]] cover build failed, logging without it', err)
				}
			}

			const gate =
				allowRule !== 'everyone' || disableLikes
					? {
							allow: allowRule === 'everyone' ? undefined : [allowRule as GateAllowRule],
							disableLikes,
						}
					: undefined

			await createLog(agent, user.did, log, {
				gate,
				game: { igdbId: game.id, record: gameRecord, exists: existing !== null },
			})
			return { logged: true }
		} catch (err) {
			console.error('[game/[slug]] log failed', err)
			return fail(500, { logError: 'Could not save your log. Try again.' })
		}
	},
}
