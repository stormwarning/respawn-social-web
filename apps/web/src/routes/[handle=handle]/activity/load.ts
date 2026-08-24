import { error, redirect, type RequestEvent } from '@sveltejs/kit'
import { Collections } from '@respawn-social/lexicons'
import { avatarUrlForBlob, type RespawnProfileRecord } from '$lib/atproto/profile'
import { publicAgent, resolveActor } from '$lib/atproto/public'
import { getRecordOrNull } from '$lib/atproto/records'
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

	const name = actor.handle ?? actor.did
	// The nav needs the actor's avatar and display name; the feed doesn't wait on
	// them, so both requests go out together.
	const [profile, activity] = await Promise.all([
		getRecordOrNull<RespawnProfileRecord>(
			publicAgent(actor.pds),
			actor.did,
			Collections.profile,
			'self',
		),
		loadActivity(actor.did, filter, url, fetch),
	])

	return {
		handle: name,
		displayName: profile?.value.displayName || name,
		avatarUrl: avatarUrlForBlob(actor.pds, actor.did, profile?.value.avatar),
		...activity,
	}
}
