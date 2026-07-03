import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

/** No-JS fallback: the header form GETs `/search/?q=...`; redirect to the clean
 *  path-segment URL `/search/<query>/` that the `[query]` route renders. */
export const load: PageServerLoad = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim()
	if (!q) redirect(307, '/')
	const segment = encodeURIComponent(q).replace(/%20/g, '+')
	redirect(307, `/search/${segment}/`)
}
