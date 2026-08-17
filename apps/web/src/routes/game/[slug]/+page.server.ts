import { error, fail, redirect } from '@sveltejs/kit'
import { getGameBySlug } from '$lib/server/backend'
import type { Actions, PageServerLoad } from './$types'
import { normalizeCoverUrl } from '$lib/server/igdb'
import { cachePageData } from '$lib/server/page-cache'
import {
	loadGameRecord,
	putGameRecord,
	type GameRef,
	type PlayedState,
	type RespawnGameRecord,
} from '$lib/atproto/game'
import { createLog, listLogs, type GateAllowRule, type RespawnLogRecord } from '$lib/atproto/log'
import { addToBacklog, loadBacklog, removeFromBacklog } from '$lib/atproto/backlog'
import { buildCover } from '$lib/server/cover'
import type { Game } from '$lib/types/game'

const PLAY_STATES = new Set(['played', 'completed', 'abandoned', 'retired', 'shelved'])
const GATE_RULES = new Set(['nobody', 'following', 'followers'])

/**
 * The id, denormalized game ref, and cover every game-record form posts. The
 * ref comes back null when the form omits it — a page loaded before the ref
 * was added still toggles, it just can't backfill. Lengths match
 * social.respawn.defs#gameRef so the PDS can't reject what we build here.
 */
function parseGameForm(
	form: FormData,
): { igdbId: number; game: GameRef | null; coverUrl: string } | { error: string } {
	const igdbId = Number(form.get('igdbId'))
	if (!Number.isInteger(igdbId) || igdbId < 1) return { error: 'Invalid game id.' }

	const slug = String(form.get('slug') ?? '').trim()
	const title = String(form.get('title') ?? '').trim()
	const usable = slug && slug.length <= 200 && title && title.length <= 2000

	return {
		igdbId,
		game: usable ? { igdbId, slug, title } : null,
		coverUrl: String(form.get('coverUrl') ?? ''),
	}
}

interface AugmentedGame extends Game {
	developer?: string[]
	publisher?: string[]
	similar_games?: Array<{ title: string; slug: string; coverUrl?: string }>
}

export const load: PageServerLoad = async ({ params, fetch, locals, setHeaders }) => {
	try {
		const game: AugmentedGame = await getGameBySlug(params.slug, fetch)

		const names = (flag: 'developer' | 'publisher') =>
			game.involved_companies
				?.filter((c) => c[flag])
				.map((c) => c.company?.name ?? '')
				.filter(Boolean)

		if (game.cover?.url) game.cover.url = normalizeCoverUrl(game.cover.url)

		if (typeof game.first_release_date === 'number') {
			game.releaseYear = new Date(game.first_release_date * 1000).getUTCFullYear()
		}

		game.developer = names('developer')
		game.publisher = names('publisher')

		if (game.similar_games) {
			game.similar_games.forEach((g) => {
				g.igdbId = g.id
				if (g.cover?.url) g.coverUrl = normalizeCoverUrl(g.cover.url)
			})
		}

		let site = game.websites?.find((w) => w.type.id === 1)?.url

		let played = false
		let playing = false
		let liked = false
		let inBacklog = false
		let rating = 0
		let ownLogs: Array<{ n: number; createdAt: string; rating: number | null }> = []
		if (locals.user && locals.agent) {
			try {
				const [rec, logs, backlog] = await Promise.all([
					loadGameRecord(locals.agent, locals.user.did, game.id),
					listLogs(locals.agent, locals.user.did, { igdbId: game.id }),
					loadBacklog(locals.agent, locals.user.did),
				])
				played = rec?.played != null
				playing = rec?.playing === true
				liked = rec?.liked === true
				rating = rec?.rating ?? 0
				inBacklog = backlog?.games.some((entry) => entry.game.igdbId === game.id) ?? false
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

		// A signed-in viewer's own played / liked / rating / backlog state is part
		// of this payload and every action on this page changes it, so only the
		// logged-out view — which is pure game data — is safe to hold. Set only
		// once the load has succeeded: the catch below turns a transient backend
		// failure into a 404, which must not be cached.
		cachePageData(setHeaders, { viewerCanMutate: Boolean(locals.user) })

		return {
			game,
			site,
			played,
			playing,
			liked,
			rating,
			inBacklog,
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
	played: async ({ request, locals }) => {
		if (!locals.user || !locals.agent) redirect(303, '/login')
		const { agent, user } = locals

		const parsed = parseGameForm(await request.formData())
		if ('error' in parsed) return fail(400, parsed)
		const { igdbId, game, coverUrl } = parsed
		const ref = game ?? undefined

		try {
			const existing = await loadGameRecord(agent, user.did, igdbId)

			// Already played → drop the played field but keep the record (cover survives).
			if (existing?.played != null) {
				const { played: _drop, ...rest } = existing
				await putGameRecord(agent, user.did, igdbId, { ...rest, game: rest.game ?? ref })
				return { played: false }
			}

			// Mark played. Build the cover once, on first creation.
			const record: RespawnGameRecord = existing
				? { ...existing, game: existing.game ?? ref, played: 'played' }
				: { game: ref, played: 'played', createdAt: new Date().toISOString() }

			if (!record.cover && coverUrl) {
				record.cover = await buildCover(agent, coverUrl)
			}

			await putGameRecord(agent, user.did, igdbId, record)
			return { played: true }
		} catch (err) {
			console.error('[game/[slug]] played failed', err)
			return fail(500, { error: 'Could not update. Try again.' })
		}
	},

	playing: async ({ request, locals }) => {
		if (!locals.user || !locals.agent) redirect(303, '/login')
		const { agent, user } = locals

		const parsed = parseGameForm(await request.formData())
		if ('error' in parsed) return fail(400, parsed)
		const { igdbId, game, coverUrl } = parsed
		const ref = game ?? undefined

		try {
			const existing = await loadGameRecord(agent, user.did, igdbId)

			// Already playing → drop the playing field but keep the record (cover survives).
			if (existing?.playing) {
				const { playing: _drop, ...rest } = existing
				await putGameRecord(agent, user.did, igdbId, { ...rest, game: rest.game ?? ref })
				return { playing: false }
			}

			const record: RespawnGameRecord = existing
				? { ...existing, game: existing.game ?? ref, playing: true }
				: { game: ref, playing: true, createdAt: new Date().toISOString() }

			if (!record.cover && coverUrl) {
				record.cover = await buildCover(agent, coverUrl)
			}

			await putGameRecord(agent, user.did, igdbId, record)
			return { playing: true }
		} catch (err) {
			console.error('[game/[slug]] playing failed', err)
			return fail(500, { error: 'Could not update. Try again.' })
		}
	},

	like: async ({ request, locals }) => {
		if (!locals.user || !locals.agent) redirect(303, '/login')
		const { agent, user } = locals

		const parsed = parseGameForm(await request.formData())
		if ('error' in parsed) return fail(400, parsed)
		const { igdbId, game, coverUrl } = parsed
		const ref = game ?? undefined

		try {
			const existing = await loadGameRecord(agent, user.did, igdbId)

			// Already liked → drop the liked field but keep the record (cover survives).
			if (existing?.liked) {
				const { liked: _drop, ...rest } = existing
				await putGameRecord(agent, user.did, igdbId, { ...rest, game: rest.game ?? ref })
				return { liked: false }
			}

			const record: RespawnGameRecord = existing
				? { ...existing, game: existing.game ?? ref, liked: true }
				: { game: ref, liked: true, createdAt: new Date().toISOString() }

			if (!record.cover && coverUrl) {
				record.cover = await buildCover(agent, coverUrl)
			}

			await putGameRecord(agent, user.did, igdbId, record)
			return { liked: true }
		} catch (err) {
			console.error('[game/[slug]] like failed', err)
			return fail(500, { error: 'Could not update. Try again.' })
		}
	},

	rate: async ({ request, locals }) => {
		if (!locals.user || !locals.agent) redirect(303, '/login')
		const { agent, user } = locals

		const form = await request.formData()
		const parsed = parseGameForm(form)
		if ('error' in parsed) return fail(400, parsed)
		const { igdbId, game, coverUrl } = parsed
		const ref = game ?? undefined

		const rating = Number(form.get('rating'))
		if (!Number.isInteger(rating) || rating < 0 || rating > 10) {
			return fail(400, { error: 'Invalid rating.' })
		}

		try {
			const existing = await loadGameRecord(agent, user.did, igdbId)

			// The lexicon's minimum is 1, so clearing means dropping the field, not writing 0.
			if (rating === 0) {
				if (existing) {
					const { rating: _drop, ...rest } = existing
					await putGameRecord(agent, user.did, igdbId, { ...rest, game: rest.game ?? ref })
				}
				return { rating: 0 }
			}

			const record: RespawnGameRecord = existing
				? { ...existing, game: existing.game ?? ref, rating }
				: { game: ref, rating, createdAt: new Date().toISOString() }

			if (!record.cover && coverUrl) {
				record.cover = await buildCover(agent, coverUrl)
			}

			await putGameRecord(agent, user.did, igdbId, record)
			return { rating }
		} catch (err) {
			console.error('[game/[slug]] rate failed', err)
			return fail(500, { error: 'Could not update. Try again.' })
		}
	},

	backlog: async ({ request, locals }) => {
		if (!locals.user || !locals.agent) redirect(303, '/login')
		const { agent, user } = locals

		const form = await request.formData()
		const parsed = parseGameForm(form)
		if ('error' in parsed) return fail(400, parsed)
		const { igdbId, game, coverUrl } = parsed
		// The client already knows the current state; trust it rather than re-reading.
		const inBacklog = form.get('inBacklog') === 'true'

		try {
			if (inBacklog) {
				await removeFromBacklog(agent, user.did, igdbId)
				return { inBacklog: false }
			}

			// Unlike the game record, a backlog item can't exist without the ref.
			if (!game) return fail(400, { error: 'Invalid game details.' })

			await addToBacklog(agent, user.did, {
				game,
				cover: coverUrl ? await buildCover(agent, coverUrl) : undefined,
			})
			return { inBacklog: true }
		} catch (err) {
			console.error('[game/[slug]] backlog failed', err)
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
				game: existing?.game ?? log.game,
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
