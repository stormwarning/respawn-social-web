import { json } from '@sveltejs/kit'

import { BackendError, searchTitles } from '$lib/server/backend'

import type { RequestHandler } from './$types'

/**
 * Lightweight JSON search endpoint for the header search dialog typeahead.
 * Returns at most 5 results with only the fields the dialog renders.
 */
export const GET: RequestHandler = async ({ url, fetch }) => {
	const q = url.searchParams.get('q')?.trim() ?? ''
	if (q.length < 2) return json({ results: [] })

	let hits
	try {
		hits = await searchTitles(q, fetch, 5)
	} catch (err) {
		console.error('[api/search] failed', err)
		// The typeahead must not render "no results" when the backend is down —
		// the dialog would silently tell the user their game does not exist.
		if (err instanceof BackendError) {
			return json({ results: [], error: 'unavailable' }, { status: 503 })
		}
		throw err
	}

	const results = hits.map(({ title, matchedTerm, kind }) => ({
		igdbId: title.id,
		name: title.displayName,
		slug: title.slug,
		year: title.releaseYear,
		// The dialog renders these in a 42px column; the backend already picked
		// the small variant.
		coverUrl: title.coverUrl,
		// A full-size cover for consumers that want one, built from the same id.
		rawCoverUrl: title.coverImageId
			? `https://images.igdb.com/igdb/image/upload/t_cover_big/${title.coverImageId}.jpg`
			: null,
		matchedTerm: kind === 'root_name' ? null : matchedTerm,
	}))

	return json({ results })
}
