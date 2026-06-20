import type { LayoutServerLoad } from './$types'

/** Expose the current user to every page for SSR rendering. */
export const load: LayoutServerLoad = ({ locals }) => {
	return { user: locals.user }
}
