import { error } from '@sveltejs/kit'
import { getGame } from '$lib/server/backend'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, fetch }) => {
	try {
		const game = await getGame(params.id, fetch)
		return { game }
	} catch (err) {
		console.error('[games/[id]] load failed', err)
		error(404, 'Game not found')
	}
}
