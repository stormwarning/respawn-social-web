import { error, redirect, type RequestEvent } from '@sveltejs/kit'
import { resolveActor } from '$lib/atproto/public'
import { loadActivity } from '$lib/server/activity'
import type { ActivityFilter } from '$lib/server/appview'

/**
 * An actor's activity page. Viewing your own is the same feed the signed-in
 * routes already serve, so redirect there rather than keeping two URLs for it —
 * 302, not the 308 the pagination routes use, because the target depends on who
 * is signed in and must not be cached as permanent.
 */
export async function loadHandleActivity(
	handle: string,
	filter: ActivityFilter,
	selfPath: string,
	{ locals, url, fetch }: Pick<RequestEvent, 'locals' | 'url' | 'fetch'>,
) {
	let actor
	try {
		actor = await resolveActor(handle)
	} catch {
		error(404, 'Account not found')
	}
	if (locals.user?.did === actor.did) redirect(302, selfPath)

	return {
		handle: actor.handle ?? actor.did,
		...(await loadActivity(actor.did, filter, url, fetch)),
	}
}
