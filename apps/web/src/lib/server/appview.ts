import { env } from '$env/dynamic/private'

/** Views returned by the appview read API (services/appview). */
export interface AppviewActor {
	did: string
	handle: string | null
	displayName: string | null
	avatarCid: string | null
}

export interface AppviewLog {
	uri: string
	cid: string
	author: AppviewActor
	record: {
		game: { igdbId: number; slug: string; title: string }
		platform?: string
		finishedPlaying?: string
		rating?: number
		liked?: boolean
		review?: { text: string; containsSpoilers?: boolean }
		createdAt: string
	}
	likeCount: number
	commentCount: number
	createdAt: string
	viewer?: { like: string | null }
}

export interface AppviewFeedPage {
	feed: AppviewLog[]
	cursor: string | null
}

export interface AppviewComment {
	uri: string
	author: AppviewActor
	text: string
	parentUri: string | null
	createdAt: string
}

export interface AppviewThread {
	log: AppviewLog
	comments: AppviewComment[]
	gate: { allow: string[] | null; disableLikes: boolean } | null
}

export interface AppviewProfile {
	actor: AppviewActor & { active: boolean; profile: unknown }
	followerCount: number
	followingCount: number
	logCount: number
	viewer?: { following: string | null }
}

/** True when APPVIEW_URL is configured; callers fall back to PDS-direct reads otherwise. */
export function appviewEnabled(): boolean {
	return Boolean(env.APPVIEW_URL)
}

async function xrpc<T>(
	nsid: string,
	params: Record<string, string | number | null | undefined>,
	fetchFn: typeof fetch = fetch,
): Promise<T> {
	const base = env.APPVIEW_URL
	if (!base) throw new Error('APPVIEW_URL is not set')
	const url = new URL(`/xrpc/${nsid}`, base)
	for (const [key, value] of Object.entries(params)) {
		if (value != null && value !== '') url.searchParams.set(key, String(value))
	}
	const headers: Record<string, string> = { accept: 'application/json' }
	if (env.APPVIEW_SECRET) headers['x-appview-secret'] = env.APPVIEW_SECRET
	const res = await fetchFn(url, { headers })
	if (!res.ok) throw new Error(`appview ${nsid} -> ${res.status} ${res.statusText}`)
	return res.json() as Promise<T>
}

export const getTimeline = (
	viewer: string,
	{ limit, cursor }: { limit?: number; cursor?: string | null } = {},
	fetchFn?: typeof fetch,
) => xrpc<AppviewFeedPage>('social.respawn.feed.getTimeline', { viewer, limit, cursor }, fetchFn)

export const getAuthorFeed = (
	actor: string,
	viewer: string | null,
	{ limit, cursor }: { limit?: number; cursor?: string | null } = {},
	fetchFn?: typeof fetch,
) =>
	xrpc<AppviewFeedPage>(
		'social.respawn.feed.getAuthorFeed',
		{ actor, viewer, limit, cursor },
		fetchFn,
	)

export const getGameActivity = (
	igdbId: number,
	viewer: string | null,
	{ limit, cursor }: { limit?: number; cursor?: string | null } = {},
	fetchFn?: typeof fetch,
) =>
	xrpc<AppviewFeedPage>(
		'social.respawn.feed.getGameActivity',
		{ igdbId, viewer, limit, cursor },
		fetchFn,
	)

export const getLogThread = (uri: string, viewer: string | null, fetchFn?: typeof fetch) =>
	xrpc<AppviewThread>('social.respawn.feed.getLogThread', { uri, viewer }, fetchFn)

export const getActorProfile = (actor: string, viewer: string | null, fetchFn?: typeof fetch) =>
	xrpc<AppviewProfile>('social.respawn.actor.getProfile', { actor, viewer }, fetchFn)
