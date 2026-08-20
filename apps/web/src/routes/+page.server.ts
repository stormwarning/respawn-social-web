import type { PageServerLoad } from './$types'
import { appviewEnabled, getTimeline } from '$lib/server/appview'
import { hydrateFeed, type HydratedFeed } from '$lib/server/feed'

export const load: PageServerLoad = async ({ locals, url, fetch }) => {
	const loggedIn = !!locals.user

	let timeline: HydratedFeed | null = null
	let feedError = false
	if (loggedIn && locals.user && appviewEnabled()) {
		// Fetch and hydration fail for unrelated reasons — the appview being
		// unreachable vs. a DID/PDS lookup going wrong — so name which one broke.
		let stage = 'getTimeline'
		try {
			const page = await getTimeline(
				locals.user.did,
				{ limit: 30, cursor: url.searchParams.get('cursor') },
				fetch,
			)
			stage = 'hydrateFeed'
			timeline = await hydrateFeed(page)
		} catch (err) {
			console.error(`[home] timeline failed during ${stage}:`, err)
			feedError = true
		}
	}

	return { loggedIn, timeline, feedError, appviewConfigured: appviewEnabled() }
}
