import { json } from '@sveltejs/kit'

import { searchGames } from '$lib/server/backend'
import { normalizeCoverUrl } from '$lib/server/igdb'

import type { RequestHandler } from './$types'

/**
 * Lightweight JSON search endpoint for the header search dialog typeahead.
 * Returns at most 5 results with only the fields the dialog renders.
 */
export const GET: RequestHandler = async ({ url, fetch }) => {
	const q = url.searchParams.get('q')?.trim() ?? ''
	if (q.length < 2) return json({ results: [] })

	const games = await searchGames(q, fetch)
	const results = games.slice(0, 5).map((game) => ({
		igdbId: game.id,
		name: game.name,
		slug: game.slug as string,
		year:
			typeof game.first_release_date === 'number'
				? new Date(game.first_release_date * 1000).getUTCFullYear()
				: null,
		// The dialog renders these in a 42px column.
		coverUrl: game.cover?.url ? normalizeCoverUrl(game.cover.url, 'small') : null,
		// Untouched IGDB url. `normalizeCoverUrl` only rewrites `/t_thumb/`, so a
		// consumer that wants a bigger variant has to start from the original.
		rawCoverUrl: game.cover?.url ?? null,
	}))

	return json({ results })
}
