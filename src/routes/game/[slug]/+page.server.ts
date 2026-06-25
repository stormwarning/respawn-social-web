import { error } from '@sveltejs/kit'
import { getGameBySlug } from '$lib/server/backend'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, fetch }) => {
	try {
		const game = await getGameBySlug(params.slug, fetch)
		return { game }
	} catch (err) {
		console.error('[game/[slug]] load failed', err)
		error(404, 'Game not found')
	}
}
