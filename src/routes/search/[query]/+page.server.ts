import { searchGames } from '$lib/server/backend'
import { normalizeCoverUrl } from '$lib/server/igdb'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, fetch }) => {
	const query = params.query.replace(/\+/g, ' ').trim()
	const games = await searchGames(query, fetch)
	for (const g of games) {
		if (g.cover?.url) g.cover.url = normalizeCoverUrl(g.cover.url)
	}
	return { query, games }
}
