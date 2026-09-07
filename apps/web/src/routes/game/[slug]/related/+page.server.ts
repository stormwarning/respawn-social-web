import { error } from '@sveltejs/kit'
import { BackendError, getTitleBySlug } from '$lib/server/backend'
import { cachePageData } from '$lib/server/page-cache'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, fetch, setHeaders }) => {
	let game
	try {
		game = await getTitleBySlug(params.slug, fetch)
	} catch (err) {
		console.error('[game/[slug]/related] load failed', err)
		if (err instanceof BackendError && err.isNotFound) error(404, 'Game not found')
		error(503, 'Game data is unavailable right now. Try again shortly.')
	}

	// Pure catalogue: the game page's viewer state is not on this page.
	cachePageData(setHeaders, { viewerCanMutate: false })

	// A series is mostly sequels, so it reads in the order it was played, not in
	// popularity order — that is only how the backend ranks the four the game
	// page has room for. The sort is stable, so titles sharing a year (and the
	// undated ones, which sort last) stay in that ranking behind the scenes.
	// When this page grows sort options, this becomes the default rather than
	// the only order.
	const byReleaseDate = game.collection.toSorted(
		(a, b) => (a.releaseYear ?? Infinity) - (b.releaseYear ?? Infinity),
	)

	return {
		slug: params.slug,
		displayName: game.displayName,
		// The `CoverList` item shape, which keys on `igdbId` and renders `title`.
		games: byReleaseDate.map((s) => ({
			igdbId: s.id,
			slug: s.slug,
			title: s.displayName,
			coverUrl: s.coverUrl,
		})),
	}
}
