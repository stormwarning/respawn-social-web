import { error, fail, redirect } from '@sveltejs/kit'
import { BackendError, getTitleBySlug } from '$lib/server/backend'
import type { Actions, PageServerLoad } from './$types'
import { cachePageData } from '$lib/server/page-cache'
import {
	putGameRecord,
	type GameRef,
	type PlayedState,
	type RespawnGameRecord,
} from '$lib/atproto/game'
import {
	createLog,
	type LogReview,
	type ReplygateSettings,
	type ReplyRule,
	type RespawnLogRecord,
} from '$lib/atproto/log'
import { addToBacklog, migrateLegacyBacklog, removeFromBacklog } from '$lib/atproto/backlog'
import { buildCover } from '$lib/server/cover'
import { forgetViewerState } from '$lib/server/viewer-state'
import { loadConsolidatedGameRecord } from '$lib/atproto/title-identity'
import type { Title } from '$lib/types/game'
import { countGraphemes, normalize } from '$lib/richtext/facets'
import { parseMedia } from '$lib/atproto/grain'
import type { Facet } from '$lib/richtext/types'

const PLAY_STATES = new Set(['played', 'completed', 'abandoned', 'retired', 'shelved'])
const REPLY_RULES = new Set<string>(['followers', 'following', 'mention'])

/**
 * The id, denormalized game ref, and cover every game-record form posts. The
 * ref comes back null when the form omits it — a page loaded before the ref
 * was added still toggles, it just can't backfill. Lengths match
 * social.respawn.defs#gameRef so the PDS can't reject what we build here.
 */
function parseGameForm(
	form: FormData,
):
	| { igdbId: number; game: GameRef | null; coverUrl: string; releaseDate?: string }
	| { error: string } {
	const igdbId = Number(form.get('igdbId'))
	if (!Number.isInteger(igdbId) || igdbId < 1) return { error: 'Invalid game id.' }

	const slug = String(form.get('slug') ?? '').trim()
	const title = String(form.get('title') ?? '').trim()
	const usable = slug && slug.length <= 200 && title && title.length <= 2000
	const releaseDateRaw = String(form.get('releaseDate') ?? '')
	const releaseTimestamp = Date.parse(releaseDateRaw)

	return {
		igdbId,
		game: usable ? { igdbId, slug, title } : null,
		coverUrl: String(form.get('coverUrl') ?? ''),
		releaseDate: Number.isFinite(releaseTimestamp)
			? new Date(releaseTimestamp).toISOString()
			: undefined,
	}
}

function withReleaseDate(
	record: RespawnGameRecord,
	releaseDate: string | undefined,
): RespawnGameRecord {
	return releaseDate && releaseDate !== record.releaseDate ? { ...record, releaseDate } : record
}

/** Lexicon limits for a log's short strings and its review. */
const LOG_STRING_MAX_GRAPHEMES = 100
const LOG_DLC_MAX_ITEMS = 20
const REVIEW_MAX_GRAPHEMES = 10000

type LogFields = Omit<RespawnLogRecord, 'game' | 'createdAt' | 'cover'>

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

/** A trimmed, length-checked string, `undefined` when blank, or `null` when invalid. */
function shortString(value: unknown): string | undefined | null {
	if (value == null) return undefined
	if (typeof value !== 'string') return null
	const trimmed = value.trim()
	if (countGraphemes(trimmed) > LOG_STRING_MAX_GRAPHEMES) return null
	return trimmed || undefined
}

/**
 * The log dialog posts its record and replygate as JSON. Both come from the
 * client, so every field is checked against the lexicon and copied over by
 * name — nothing is spread — and the review's rich text is re-serialized. The
 * game ref and `createdAt` are the server's to set.
 */
function parseLogForm(
	form: FormData,
	did: string,
): { fields: LogFields; replygate?: ReplygateSettings } | { error: string } {
	let raw: unknown
	let rawGate: unknown
	try {
		raw = JSON.parse(String(form.get('log') ?? ''))
		const gate = String(form.get('replygate') ?? '')
		rawGate = gate ? JSON.parse(gate) : undefined
	} catch {
		return { error: 'Invalid log.' }
	}
	if (!isRecord(raw)) return { error: 'Invalid log.' }

	const platform = shortString(raw.platform)
	const edition = shortString(raw.edition)
	if (platform === null || edition === null) return { error: 'Invalid platform or edition.' }

	let dlc: string[] | undefined
	if (raw.dlc != null) {
		if (!Array.isArray(raw.dlc) || raw.dlc.length > LOG_DLC_MAX_ITEMS) {
			return { error: 'Invalid DLC.' }
		}
		const items = raw.dlc.map(shortString)
		if (items.some((item) => item === null)) return { error: 'Invalid DLC.' }
		const kept = items.filter((item): item is string => Boolean(item))
		dlc = kept.length ? kept : undefined
	}

	let datePlayed: string | undefined
	if (raw.datePlayed != null) {
		const timestamp = typeof raw.datePlayed === 'string' ? Date.parse(raw.datePlayed) : NaN
		if (!Number.isFinite(timestamp)) return { error: 'Invalid date played.' }
		datePlayed = new Date(timestamp).toISOString()
	}

	if (raw.startedPlaying != null && typeof raw.startedPlaying !== 'boolean') {
		return { error: 'Invalid play state.' }
	}
	if (
		raw.finishedPlaying != null &&
		(typeof raw.finishedPlaying !== 'string' || !PLAY_STATES.has(raw.finishedPlaying))
	) {
		return { error: 'Invalid play state.' }
	}

	const rating = raw.rating
	if (
		rating != null &&
		(typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 10)
	) {
		return { error: 'Invalid rating.' }
	}
	if (raw.liked != null && typeof raw.liked !== 'boolean') return { error: 'Invalid like.' }

	let review: LogReview | undefined
	if (raw.review != null) {
		const r = raw.review
		if (
			!isRecord(r) ||
			typeof r.text !== 'string' ||
			(r.textWithSpoilers != null && typeof r.textWithSpoilers !== 'string') ||
			(r.facets != null && !Array.isArray(r.facets)) ||
			(r.containsSpoilers != null && typeof r.containsSpoilers !== 'boolean')
		) {
			return { error: 'Invalid review.' }
		}
		const text = normalize({
			text: r.text,
			textWithSpoilers: r.textWithSpoilers as string | undefined,
			facets: r.facets as Facet[] | undefined,
		})
		if (
			Math.max(countGraphemes(text.text), countGraphemes(text.textWithSpoilers ?? '')) >
			REVIEW_MAX_GRAPHEMES
		) {
			return { error: 'Your review is too long.' }
		}
		if (text.text.trim()) {
			review = {
				text: text.text,
				...(text.textWithSpoilers ? { textWithSpoilers: text.textWithSpoilers } : {}),
				...(text.facets?.length ? { facets: text.facets } : {}),
				...(r.containsSpoilers ? { containsSpoilers: true } : {}),
			}
		}
	}

	const media = parseMedia(raw.media, did)
	if ('error' in media) return media

	// Absent means anyone; `[]` means no one; otherwise the union of the rules.
	let replygate: ReplygateSettings | undefined
	if (rawGate !== undefined) {
		const allow = isRecord(rawGate) ? rawGate.allow : undefined
		if (!Array.isArray(allow) || !allow.every((rule) => REPLY_RULES.has(rule))) {
			return { error: 'Invalid comment setting.' }
		}
		replygate = { allow: [...new Set(allow as ReplyRule[])] }
	}

	const fields: LogFields = {
		...(edition ? { edition } : {}),
		...(dlc ? { dlc } : {}),
		...(platform ? { platform } : {}),
		...(datePlayed ? { datePlayed } : {}),
		...(raw.startedPlaying ? { startedPlaying: true } : {}),
		...(raw.finishedPlaying ? { finishedPlaying: raw.finishedPlaying as PlayedState } : {}),
		...(rating ? { rating } : {}),
		...(raw.liked ? { liked: true } : {}),
		...(review ? { review } : {}),
		...(media.length ? { media } : {}),
	}
	return { fields, replygate }
}

/** The `CoverList` item shape, which keys on `igdbId` and renders `title`. */
function toCoverItem(ref: Title['similar'][number] | Title['collection'][number]) {
	return {
		igdbId: ref.id,
		slug: ref.slug,
		title: ref.displayName,
		coverUrl: ref.coverUrl ?? undefined,
	}
}

/** IGDB website type 1 is the game's own site. */
const OFFICIAL_SITE = 1

export const load: PageServerLoad = async ({ params, fetch, locals, setHeaders }) => {
	const { timings } = locals
	try {
		// Everything this page used to assemble by hand — developer and publisher
		// names, the release year, cover URLs, similar-game shaping — now arrives
		// already derived. See §10 of docs/PLAN-igdb-mirror.md in the API repo.
		const game = await timings.track('game.title', () => getTitleBySlug(params.slug, fetch))

		const site = game.websites.find((w) => w.type === OFFICIAL_SITE)?.url
		// Four each: the rest of both lists lives on the /similar/ and /related/
		// sub-pages, which re-read this same title rather than being paginated.
		const similar = game.similar.slice(0, 4).map(toCoverItem)
		// `game.related` is something else — descendants shown as "Released
		// separately". This is the series: siblings from the IGDB collection.
		const series = game.collection.slice(0, 4).map(toCoverItem)

		// Pure game data: the viewer's own played / liked / rating / backlog state
		// now lives in the client store, hydrated from /api/viewer/state, so
		// nothing here changes when they act on the game and a signed-in viewer
		// can hold this copy too. Set only once the load has succeeded: the catch
		// below turns a transient backend failure into a 404, which must not be
		// cached.
		cachePageData(setHeaders, { viewerCanMutate: false })

		return {
			game,
			similar,
			series,
			site,
			isLoggedIn: !!locals.user,
			viewerHandle: locals.user?.handle ?? locals.user?.did ?? null,
		}
	} catch (err) {
		console.error('[game/[slug]] load failed', err)
		// Only a real 404 from the backend means the game is not there. Anything
		// else — the API down, a 500, a timeout — is our problem, and saying
		// "Game not found" would hide an outage behind a plausible-looking page.
		if (err instanceof BackendError && err.isNotFound) {
			error(404, 'Game not found')
		}
		error(503, 'Game data is unavailable right now. Try again shortly.')
	}
}

export const actions: Actions = {
	playState: async ({ request, fetch, locals }) => {
		if (!locals.user || !locals.agent) redirect(303, '/login')
		const { agent, user, timings } = locals

		const form = await request.formData()
		const parsed = parseGameForm(form)
		if ('error' in parsed) return fail(400, parsed)
		const { igdbId, game, coverUrl, releaseDate } = parsed
		const ref = game ?? undefined

		const state = String(form.get('state') ?? '')
		const isToggle = state === 'playing' || state === 'stop-playing'
		if (!isToggle && state !== 'unplayed' && !PLAY_STATES.has(state)) {
			return fail(400, { error: 'Invalid play state.' })
		}

		try {
			// Fold in any record left under an id that has since folded into this
			// title, so acting on it does not create a second one. Lazy: one user,
			// one action, no bulk job over other people's repos.
			const existing = await timings.track('action.existing', () =>
				loadConsolidatedGameRecord(agent, user.did, igdbId, undefined, fetch),
			)

			// `playing` and `played` are independent: replaying something you have
			// already finished sets both. "unplayed" drops only `played`; the
			// record itself stays so the cover, rating and like survive.
			const {
				played: prevPlayed,
				playing: prevPlaying,
				...rest
			}: Partial<RespawnGameRecord> = existing ?? {}
			const base: RespawnGameRecord = {
				...rest,
				game: rest.game ?? ref,
				createdAt: rest.createdAt ?? new Date().toISOString(),
			}

			const playing = isToggle ? state === 'playing' : prevPlaying === true
			const played = isToggle
				? prevPlayed
				: state === 'unplayed'
					? undefined
					: (state as PlayedState)

			const record: RespawnGameRecord = {
				...base,
				...(playing ? { playing: true } : {}),
				...(played ? { played } : {}),
			}

			if ((playing || played) && !record.cover && coverUrl) {
				record.cover = await timings.track('action.cover', () => buildCover(agent, coverUrl, fetch))
			}

			await timings.track('action.put', () =>
				putGameRecord(agent, user.did, igdbId, withReleaseDate(record, releaseDate)),
			)
			forgetViewerState(user.did)
			return { played: record.played ?? null, playing: record.playing === true }
		} catch (err) {
			console.error('[game/[slug]] playState failed', err)
			return fail(500, { error: 'Could not update. Try again.' })
		}
	},

	like: async ({ request, fetch, locals }) => {
		if (!locals.user || !locals.agent) redirect(303, '/login')
		const { agent, user, timings } = locals

		const parsed = parseGameForm(await request.formData())
		if ('error' in parsed) return fail(400, parsed)
		const { igdbId, game, coverUrl } = parsed
		const ref = game ?? undefined

		try {
			// Fold in any record left under an id that has since folded into this
			// title, so acting on it does not create a second one. Lazy: one user,
			// one action, no bulk job over other people's repos.
			const existing = await timings.track('action.existing', () =>
				loadConsolidatedGameRecord(agent, user.did, igdbId, undefined, fetch),
			)

			// Already liked → drop the liked field but keep the record (cover survives).
			if (existing?.liked) {
				const { liked: _drop, ...rest } = existing
				await timings.track('action.put', () =>
					putGameRecord(agent, user.did, igdbId, { ...rest, game: rest.game ?? ref }),
				)
				forgetViewerState(user.did)
				return { liked: false }
			}

			const record: RespawnGameRecord = existing
				? { ...existing, game: existing.game ?? ref, liked: true }
				: { game: ref, liked: true, createdAt: new Date().toISOString() }

			if (!record.cover && coverUrl) {
				record.cover = await timings.track('action.cover', () => buildCover(agent, coverUrl, fetch))
			}

			await timings.track('action.put', () => putGameRecord(agent, user.did, igdbId, record))
			forgetViewerState(user.did)
			return { liked: true }
		} catch (err) {
			console.error('[game/[slug]] like failed', err)
			return fail(500, { error: 'Could not update. Try again.' })
		}
	},

	rate: async ({ request, fetch, locals }) => {
		if (!locals.user || !locals.agent) redirect(303, '/login')
		const { agent, user, timings } = locals

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
			// Fold in any record left under an id that has since folded into this
			// title, so acting on it does not create a second one. Lazy: one user,
			// one action, no bulk job over other people's repos.
			const existing = await timings.track('action.existing', () =>
				loadConsolidatedGameRecord(agent, user.did, igdbId, undefined, fetch),
			)

			// The lexicon's minimum is 1, so clearing means dropping the field, not writing 0.
			if (rating === 0) {
				if (existing) {
					const { rating: _drop, ...rest } = existing
					await timings.track('action.put', () =>
						putGameRecord(agent, user.did, igdbId, { ...rest, game: rest.game ?? ref }),
					)
					forgetViewerState(user.did)
				}
				return { rating: 0 }
			}

			const record: RespawnGameRecord = existing
				? { ...existing, game: existing.game ?? ref, rating }
				: { game: ref, rating, createdAt: new Date().toISOString() }

			if (!record.cover && coverUrl) {
				record.cover = await timings.track('action.cover', () => buildCover(agent, coverUrl, fetch))
			}

			await timings.track('action.put', () => putGameRecord(agent, user.did, igdbId, record))
			forgetViewerState(user.did)
			return { rating }
		} catch (err) {
			console.error('[game/[slug]] rate failed', err)
			return fail(500, { error: 'Could not update. Try again.' })
		}
	},

	backlog: async ({ request, fetch, locals }) => {
		if (!locals.user || !locals.agent) redirect(303, '/login')
		const { agent, user, timings } = locals

		const form = await request.formData()
		const parsed = parseGameForm(form)
		if ('error' in parsed) return fail(400, parsed)
		const { igdbId, game, coverUrl, releaseDate } = parsed
		// The client already knows the current state; trust it rather than re-reading.
		const inBacklog = form.get('inBacklog') === 'true'

		try {
			await timings.track('action.migrate', () => migrateLegacyBacklog(agent, user.did))

			if (inBacklog) {
				await timings.track('action.put', () => removeFromBacklog(agent, user.did, igdbId))
				forgetViewerState(user.did)
				return { inBacklog: false }
			}

			// Unlike the game record, a backlog item can't exist without the ref.
			if (!game) return fail(400, { error: 'Invalid game details.' })

			const cover = coverUrl
				? await timings.track('action.cover', () => buildCover(agent, coverUrl, fetch))
				: undefined
			await timings.track('action.put', () =>
				addToBacklog(agent, user.did, { game, cover, releaseDate }),
			)
			forgetViewerState(user.did)
			return { inBacklog: true }
		} catch (err) {
			console.error('[game/[slug]] backlog failed', err)
			return fail(500, { error: 'Could not update. Try again.' })
		}
	},

	log: async ({ params, request, fetch, locals }) => {
		if (!locals.user || !locals.agent) redirect(303, '/login')
		const { agent, user, timings } = locals

		const parsed = parseLogForm(await request.formData(), user.did)
		if ('error' in parsed) return fail(400, parsed)
		const { fields, replygate } = parsed

		try {
			// Refetch the game server-side so the denormalized ref can't drift.
			const game = await timings.track('game.title', () => getTitleBySlug(params.slug, fetch))
			const createdAt = new Date().toISOString()

			const log: RespawnLogRecord = {
				// `displayName`, not `name`: the ref is what other people see.
				game: { igdbId: game.id, slug: params.slug, title: game.displayName },
				...fields,
				createdAt,
			}

			// Denormalized current state on the game record, written atomically.
			// Fold in any record left under an id that has since folded into this
			// title, so logging it does not create a second one.
			const existing = await timings.track('action.existing', () =>
				loadConsolidatedGameRecord(agent, user.did, game.id, game.members, fetch),
			)
			const {
				played: prevPlayed,
				playing: prevPlaying,
				...rest
			}: Partial<RespawnGameRecord> = existing ?? {}
			// A finished session ends the playthrough; one that only started it begins one.
			const playing = fields.finishedPlaying ? false : fields.startedPlaying || prevPlaying === true
			const played = fields.finishedPlaying ?? prevPlayed
			// The dialog opens on the game's current rating and like, so what it sends
			// is the new state: clearing either there clears it here.
			const { rating: _rating, liked: _liked, ...kept } = rest
			const gameRecord: RespawnGameRecord = {
				...kept,
				game: rest.game ?? log.game,
				...(playing ? { playing: true } : {}),
				...(played ? { played } : {}),
				...(fields.rating ? { rating: fields.rating } : {}),
				...(fields.liked ? { liked: true } : {}),
				releaseDate: game.firstReleaseDate ?? rest.releaseDate,
				createdAt: rest.createdAt ?? createdAt,
			}
			const { coverUrl } = game
			if (!gameRecord.cover && coverUrl) {
				try {
					gameRecord.cover = await timings.track('action.cover', () =>
						buildCover(agent, coverUrl, fetch),
					)
				} catch (err) {
					console.error('[game/[slug]] cover build failed, logging without it', err)
				}
			}

			await timings.track('action.put', () =>
				createLog(agent, user.did, log, {
					replygate,
					game: { igdbId: game.id, record: gameRecord, exists: existing !== null },
				}),
			)
			forgetViewerState(user.did)
			return {
				played: gameRecord.played ?? null,
				playing: gameRecord.playing === true,
				rating: gameRecord.rating ?? 0,
				liked: gameRecord.liked === true,
			}
		} catch (err) {
			console.error('[game/[slug]] log failed', err)
			return fail(500, { error: 'Could not save your log. Try again.' })
		}
	},
}
