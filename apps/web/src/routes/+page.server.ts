import type { PageServerLoad } from './$types'
import { appviewEnabled, getTimeline, type AppviewFeedPage } from '$lib/server/appview'

export const load: PageServerLoad = async ({ locals, url, fetch }) => {
	const loggedIn = !!locals.user

	let timeline: AppviewFeedPage | null = null
	let feedError = false
	if (loggedIn && locals.user && appviewEnabled()) {
		try {
			timeline = await getTimeline(
				locals.user.did,
				{ limit: 30, cursor: url.searchParams.get('cursor') },
				fetch,
			)
		} catch (err) {
			console.error('[home] timeline failed', err)
			feedError = true
		}
	}

	return { loggedIn, timeline, feedError, appviewConfigured: appviewEnabled() }
}
