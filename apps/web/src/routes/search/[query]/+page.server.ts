import { searchGames } from '$lib/server/backend'
import { normalizeCoverUrl } from '$lib/server/igdb'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, fetch }) => {
	const query = params.query.replace(/\+/g, ' ').trim()
	const games = await searchGames(query, fetch)

	for (const g of games) {
		g.coverUrl = g.cover?.url ? normalizeCoverUrl(g.cover.url) : undefined
		g.year =
			typeof g.first_release_date === 'number'
				? new Date(g.first_release_date * 1000).getUTCFullYear()
				: null
	}

	return { query, games }
}
