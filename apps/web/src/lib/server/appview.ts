import { env } from '$env/dynamic/private'
import type { BlobRef } from '@atproto/api'

/** Views returned by HappyView (see services/appview for the deployment runbook). */
export interface FeedGameRef {
	igdbId: number
	slug: string
	title: string
}

export interface FeedCover {
	/** Serialized blob, i.e. `{$type:'blob',ref:{$link},…}`; `blobUrl` reads it as-is. */
	image?: BlobRef
}

/**
 * One activity event, matching `social.respawn.feed.getActivity#feedItem`.
 * `type` selects which optional fields are set.
 */
export interface FeedItem {
	type: 'backlogAdd' | 'follow' | (string & {})
	uri: string
	did: string
	createdAt: string
	game?: FeedGameRef
	cover?: FeedCover
	subject?: string
}

export interface FeedPage {
	feed: FeedItem[]
	cursor: string | null
}

/** True when HAPPYVIEW_URL is configured; callers fall back to PDS-direct reads otherwise. */
export function appviewEnabled(): boolean {
	return Boolean(env.HAPPYVIEW_URL)
}

async function xrpc<T>(
	nsid: string,
	params: Record<string, string | number | null | undefined>,
	fetchFn: typeof fetch = fetch,
): Promise<T> {
	const base = env.HAPPYVIEW_URL
	if (!base) throw new Error('HAPPYVIEW_URL is not set')
	const url = new URL(`/xrpc/${nsid}`, base)
	for (const [key, value] of Object.entries(params)) {
		if (value != null && value !== '') url.searchParams.set(key, String(value))
	}
	// No Authorization header: HappyView's XRPC routes reject Bearer API keys
	// outright (those are for the admin API) and serve public records
	// anonymously. The feed takes the actor it is about as a parameter, not
	// from auth.
	//
	// `credentials: 'omit'` stops SvelteKit's fetch from attaching our cookies.
	// It forwards them whenever the target hostname is the app's hostname or a
	// subdomain of it, ignoring the port — so in dev, where the app is on
	// 127.0.0.1:5173 and HappyView on 127.0.0.1:3080, a HappyView dashboard
	// session cookie set by the browser rides along and the appview answers 401
	// `Missing client identification`: it sees an authenticated caller with no
	// client key. Omitting also keeps our session cookie out of the appview if
	// it is ever hosted on a subdomain of the app.
	const res = await fetchFn(url, {
		headers: { accept: 'application/json' },
		credentials: 'omit',
	})
	if (!res.ok) {
		// HappyView reports the useful part — a Lua error, an unregistered
		// lexicon, an unknown host — in the body, so the status alone says little.
		const detail = await res.text().catch(() => '')
		throw new Error(
			`happyview ${nsid} -> ${res.status} ${res.statusText}` +
				`\n  url: ${url.origin}${url.pathname}?${url.searchParams}` +
				(detail ? `\n  body: ${detail.slice(0, 1000)}` : ''),
		)
	}
	return res.json() as Promise<T>
}

/**
 * Which slice of an actor's activity to fetch. `author` is what they did,
 * `incoming` is what others did to them, `following` is what the accounts they
 * follow did, and `all` is the union.
 */
export type ActivityFilter = 'all' | 'author' | 'incoming' | 'following'

export const getActivity = (
	actor: string,
	{
		filter,
		limit,
		cursor,
	}: { filter?: ActivityFilter; limit?: number; cursor?: string | null } = {},
	fetchFn?: typeof fetch,
) => xrpc<FeedPage>('social.respawn.feed.getActivity', { actor, filter, limit, cursor }, fetchFn)
