import { error } from '@sveltejs/kit'
import { BackendError, searchTitles } from '$lib/server/backend'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, fetch }) => {
	const query = params.query.replace(/\+/g, ' ').trim()

	let hits
	try {
		hits = await searchTitles(query, fetch)
	} catch (err) {
		console.error('[search/[query]] load failed', err)
		// An empty result list would read as "no such game", which is a different
		// and much more misleading statement than "search is down".
		if (err instanceof BackendError) {
			error(503, 'Search is unavailable right now. Try again shortly.')
		}
		throw err
	}

	// Return only what the result list renders. A hit also carries the score and
	// the full platform objects, and all of it would otherwise be serialized
	// into the SSR payload for every result.
	const games = hits.map(({ title, matchedTerm, kind }) => ({
		slug: title.slug,
		name: title.displayName,
		platforms: title.platforms,
		coverUrl: title.coverUrl ?? undefined,
		year: title.releaseYear,
		// Why this result matched, when it wasn't the title's own name. Without
		// it, searching "blood and wine" and getting "The Witcher 3" looks broken
		// rather than correct.
		matchedTerm: kind === 'root_name' ? null : matchedTerm,
	}))

	return { query, games }
}
