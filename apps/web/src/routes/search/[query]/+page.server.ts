import { searchTitles } from '$lib/server/backend'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, fetch }) => {
	const query = params.query.replace(/\+/g, ' ').trim()
	const hits = await searchTitles(query, fetch)

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
