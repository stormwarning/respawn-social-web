import { json } from '@sveltejs/kit'
import { hasGrainPhotos } from '$lib/atproto/grain'
import type { RequestHandler } from './$types'

/**
 * Whether the signed-in viewer has any Grain photos, so the log dialog knows
 * whether to offer its photos field. One `describeRepo` call; nothing is listed.
 */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user || !locals.agent) return json({ error: 'unauthorized' }, { status: 401 })
	const { agent, timings, user } = locals

	try {
		const hasPhotos = await timings.track('grain.has', () => hasGrainPhotos(agent, user.did))
		return json({ hasPhotos }, { headers: { 'cache-control': 'private, max-age=300' } })
	} catch (err) {
		console.error('[api/viewer/grain] failed', err)
		return json({ error: 'unavailable' }, { status: 503 })
	}
}
