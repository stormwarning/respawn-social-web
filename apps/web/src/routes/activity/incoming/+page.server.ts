import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { loadActivity } from '$lib/server/activity'

export const load: PageServerLoad = async ({ locals, url, fetch }) => {
	if (!locals.user) redirect(303, '/login')
	return loadActivity(locals.user.did, 'incoming', url, fetch)
}
