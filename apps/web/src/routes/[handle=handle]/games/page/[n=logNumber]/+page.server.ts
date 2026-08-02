import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { loadGamesPage } from '../../load'

export const load: PageServerLoad = ({ params, locals }) => {
	const page = Number(params.n)
	// Page one lives at /[handle]/games/, so keep a single canonical URL for it.
	if (page === 1) redirect(308, `/${params.handle}/games/`)
	return loadGamesPage(params.handle, page, locals)
}
