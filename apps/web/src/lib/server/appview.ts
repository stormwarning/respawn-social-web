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
 * One activity event, matching `social.respawn.feed.getTimeline#feedItem`.
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
	const headers: Record<string, string> = { accept: 'application/json' }
	if (env.HAPPYVIEW_API_KEY) headers.authorization = `Bearer ${env.HAPPYVIEW_API_KEY}`
	const res = await fetchFn(url, { headers })
	if (!res.ok) throw new Error(`happyview ${nsid} -> ${res.status} ${res.statusText}`)
	return res.json() as Promise<T>
}

export const getTimeline = (
	viewer: string,
	{ limit, cursor }: { limit?: number; cursor?: string | null } = {},
	fetchFn?: typeof fetch,
) => xrpc<FeedPage>('social.respawn.feed.getTimeline', { viewer, limit, cursor }, fetchFn)
