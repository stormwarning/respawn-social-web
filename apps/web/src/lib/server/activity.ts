import { appviewEnabled, getActivity, type ActivityFilter } from '$lib/server/appview'
import { hydrateFeed, type HydratedFeed } from '$lib/server/feed'

const PAGE_SIZE = 30

export interface ActivityPage {
	feed: HydratedFeed | null
	feedError: boolean
	appviewConfigured: boolean
}

/**
 * Load one page of an actor's activity for a route. Every activity page shares
 * this shape, so the appview-unconfigured and failed cases stay identical
 * wherever a feed is rendered: both leave `feed` null and let the page say why
 * rather than erroring.
 */
export async function loadActivity(
	actor: string,
	filter: ActivityFilter,
	url: URL,
	fetchFn: typeof fetch,
): Promise<ActivityPage> {
	const appviewConfigured = appviewEnabled()
	if (!appviewConfigured) return { feed: null, feedError: false, appviewConfigured }

	// Fetch and hydration fail for unrelated reasons — the appview being
	// unreachable vs. a DID/PDS lookup going wrong — so name which one broke.
	let stage = 'getActivity'
	try {
		const page = await getActivity(
			actor,
			{ filter, limit: PAGE_SIZE, cursor: url.searchParams.get('cursor') },
			fetchFn,
		)
		stage = 'hydrateFeed'
		return { feed: await hydrateFeed(page), feedError: false, appviewConfigured }
	} catch (err) {
		console.error(`[activity] ${filter} feed failed during ${stage}:`, err)
		return { feed: null, feedError: true, appviewConfigured }
	}
}
