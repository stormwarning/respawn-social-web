import { resolvePdsEndpoint } from '$lib/atproto/identity'
import type { Did } from '@atcute/lexicons/syntax'
import { avatarUrlForBlob } from '$lib/atproto/profile'
import { cachedBskyProfile, cachedRespawnProfile } from '$lib/server/profile-cache'
import type { LayoutServerLoad } from './$types'

export const trailingSlash = 'always'

/** Expose the current user to every page for SSR rendering. */
export const load: LayoutServerLoad = async ({ depends, locals, url }) => {
	// SvelteKit only re-runs a server load on client-side navigation when
	// something it *read* changed. This load reads `locals`, which SvelteKit
	// cannot track, so without a tracked dependency the header keeps rendering
	// the old user for the rest of the session once the session goes away —
	// pages render signed out while the header still shows an avatar. Touching
	// `url` makes every navigation re-run it; `depends` lets client code force a
	// refresh via `invalidate('app:session')`.
	void url.pathname
	depends('app:session')

	if (!locals.user || !locals.agent) {
		return { user: null }
	}

	const { agent, timings, user } = locals
	// Enrich the bare DID with handle + avatar for the header. This runs on every
	// authenticated render, so the three lookups go out concurrently and all three
	// are cached; a failure here must not break page rendering, so fall back to
	// the DID. The PDS is resolved unconditionally rather than only when an avatar
	// blob exists — a cache hit costs nothing and keeps it off the critical path.
	try {
		const [bsky, respawn, pds] = await timings.track('layout.profile', () =>
			Promise.all([
				cachedBskyProfile(agent, user.did),
				cachedRespawnProfile(agent, user.did),
				resolvePdsEndpoint(user.did as Did),
			]),
		)

		let avatarUrl = bsky.avatarUrl
		if (respawn?.avatar) {
			avatarUrl = avatarUrlForBlob(pds, user.did, respawn.avatar) ?? avatarUrl
		}

		return {
			user: {
				did: user.did,
				handle: bsky.handle,
				displayName: respawn?.displayName || bsky.displayName || bsky.handle,
				avatarUrl,
			},
		}
	} catch (err) {
		console.error('[layout] profile enrichment failed', err)
		return {
			user: { did: user.did, handle: undefined, displayName: undefined, avatarUrl: null },
		}
	}
}
