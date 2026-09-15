import { json } from '@sveltejs/kit'

import { loadViewerState } from '$lib/server/viewer-state'

import type { RequestHandler } from './$types'

/**
 * The signed-in viewer's own game and backlog state, fetched once per session by
 * the client store in `$lib/viewer-state.svelte.ts`. It lives here rather than in
 * page payloads so list pages stay viewer-independent, and so `cachePageData`
 * keeps working for signed-in users.
 */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user || !locals.agent) return json({ error: 'unauthorized' }, { status: 401 })
	const { agent, timings, user } = locals

	try {
		const state = await timings.track('viewer.state', () => loadViewerState(agent, user.did))
		return json(state, { headers: { 'cache-control': 'private, no-store' } })
	} catch (err) {
		console.error('[api/viewer/state] failed', err)
		return json({ error: 'unavailable' }, { status: 503 })
	}
}
