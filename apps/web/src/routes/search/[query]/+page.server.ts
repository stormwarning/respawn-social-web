import { searchGames } from '$lib/server/backend'
import { normalizeCoverUrl } from '$lib/server/igdb'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, fetch }) => {
	const query = params.query.replace(/\+/g, ' ').trim()
	const results = await searchGames(query, fetch)

	// Return only what the result list renders. The backend's Game carries the
	// summary, websites and external IDs too, and all of it would otherwise be
	// serialized into the SSR payload for every result.
	const games = results.map((game) => ({
		slug: game.slug,
		name: game.name,
		platforms: game.platforms,
		// The result list renders these in a 72px column.
		coverUrl: game.cover?.url ? normalizeCoverUrl(game.cover.url, 'small') : undefined,
		year:
			typeof game.first_release_date === 'number'
				? new Date(game.first_release_date * 1000).getUTCFullYear()
				: null,
	}))

	return { query, games }
}
