import { error, redirect } from '@sveltejs/kit'
import { BackendError, browseTitles } from '$lib/server/backend'
import { cachePageData } from '$lib/server/page-cache'
import type { PageServerLoad } from './$types'
import { browsePath, PAGE_SIZE, parseSegments } from '../filters'

export const load: PageServerLoad = async ({ params, url, fetch, setHeaders }) => {
	const segments = params.filters.split('/').filter(Boolean)
	const parsed = parseSegments(segments)
	if (!parsed) error(404, 'Page not found')
	const { filters, page } = parsed

	// One URL per list: segments in another order, or an explicit page one,
	// land on the canonical path the menu and pagination link to.
	const canonical = browsePath(filters, page)
	if (url.pathname !== canonical) redirect(308, canonical)

	let result
	try {
		result = await browseTitles({ ...filters, page, limit: PAGE_SIZE }, fetch)
	} catch (err) {
		console.error('[games] load failed', err)
		// An empty grid would read as "no games", which is a different and much
		// more misleading statement than "the catalogue is down".
		if (err instanceof BackendError) {
			error(503, 'Game data is unavailable right now. Try again shortly.')
		}
		throw err
	}

	// A page past the end comes back empty with no total, so the first page has
	// to say how many there are. Only page one can legitimately be empty.
	const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE))
	if (page > totalPages) error(404, 'Page not found')

	// Pure catalogue: nothing here depends on who is looking.
	cachePageData(setHeaders, { viewerCanMutate: false })

	return {
		filters,
		page,
		totalPages,
		total: result.total,
		thisYear: new Date().getFullYear(),
		// The `CoverList` item shape, which keys on `igdbId` and renders `title`.
		games: result.items.map((title) => ({
			igdbId: title.id,
			slug: title.slug,
			title: title.displayName,
			coverUrl: title.coverUrl,
		})),
	}
}
