import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { loadBacklogPage } from '../../load'

export const load: PageServerLoad = ({ params, locals, setHeaders }) => {
	const page = Number(params.n)
	// Page one lives at /[handle]/backlog/, so keep a single canonical URL for it.
	if (page === 1) redirect(308, `/${params.handle}/backlog/`)
	return loadBacklogPage(params.handle, page, locals, setHeaders)
}
