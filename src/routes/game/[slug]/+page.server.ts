import { error } from '@sveltejs/kit'
import { getGameBySlug } from '$lib/server/backend'
import type { PageServerLoad } from './$types'
import { normalizeCoverUrl } from '$lib/server/igdb'

export const load: PageServerLoad = async ({ params, fetch }) => {
	try {
		const game = await getGameBySlug(params.slug, fetch)

		const names = (flag: 'developer' | 'publisher') =>
			game.involved_companies
				?.filter((c) => c[flag])
				.map((c) => c.company?.name)
				.filter(Boolean)
				.join(', ')

		if (game.cover?.url) game.cover.url = normalizeCoverUrl(game.cover.url)
		// if (game.platforms) game.platforms = game.platforms.map((p) => p.name).join(', ')

		game.developer = names('developer')
		game.publisher = names('publisher')

		console.log('GAME', game)

		return { game }
	} catch (err) {
		console.error('[game/[slug]] load failed', err)
		error(404, 'Game not found')
	}
}
