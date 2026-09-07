import { error } from '@sveltejs/kit'
import { BackendError, getTitleBySlug } from '$lib/server/backend'
import { cachePageData } from '$lib/server/page-cache'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, fetch, setHeaders }) => {
	let game
	try {
		game = await getTitleBySlug(params.slug, fetch)
	} catch (err) {
		console.error('[game/[slug]/similar] load failed', err)
		if (err instanceof BackendError && err.isNotFound) error(404, 'Game not found')
		error(503, 'Game data is unavailable right now. Try again shortly.')
	}

	// Pure catalogue: the game page's viewer state is not on this page.
	cachePageData(setHeaders, { viewerCanMutate: false })

	return {
		slug: params.slug,
		displayName: game.displayName,
		// The `CoverList` item shape, which keys on `igdbId` and renders `title`.
		games: game.similar.map((s) => ({
			igdbId: s.id,
			slug: s.slug,
			title: s.displayName,
			coverUrl: s.coverUrl,
		})),
	}
}
