import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

// Profile editing moved to /settings; public profiles live at /[handle].
export const load: PageServerLoad = async () => {
	redirect(301, '/settings/')
}
