import { error, fail, redirect } from '@sveltejs/kit'
import { getGameBySlug } from '$lib/server/backend'
import type { Actions, PageServerLoad } from './$types'
import { normalizeCoverUrl } from '$lib/server/igdb'
import { loadGameRecord, putGameRecord, type RespawnGameRecord } from '$lib/atproto/game'
import { buildCover } from '$lib/server/cover'

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
		if (locals.user && locals.agent) {
			try {
				const rec = await loadGameRecord(locals.agent, locals.user.did, game.id)
				played = rec?.played != null
			} catch (err) {
				console.error('[game/[slug]] played lookup failed', err)
			}
		}

		return { game, site, played, isLoggedIn: !!locals.user }
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
}
