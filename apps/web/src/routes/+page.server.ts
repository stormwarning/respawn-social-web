import type { PageServerLoad } from './$types'
import { appviewEnabled, getTimeline } from '$lib/server/appview'
import { hydrateFeed, type HydratedFeed } from '$lib/server/feed'

export const load: PageServerLoad = async ({ locals, url, fetch }) => {
	const loggedIn = !!locals.user

	let timeline: HydratedFeed | null = null
	let feedError = false
	if (loggedIn && locals.user && appviewEnabled()) {
		try {
			const page = await getTimeline(
				locals.user.did,
				{ limit: 30, cursor: url.searchParams.get('cursor') },
				fetch,
			)
			timeline = await hydrateFeed(page)
		} catch (err) {
			console.error('[home] timeline failed', err)
			feedError = true
		}
	}

	return { loggedIn, timeline, feedError, appviewConfigured: appviewEnabled() }
}
