import { resolvePdsEndpoint } from '$lib/atproto/identity'
import type { Did } from '@atcute/lexicons/syntax'
import { avatarUrlForBlob, loadBskyProfile, loadRespawnProfile } from '$lib/atproto/profile'
import type { LayoutServerLoad } from './$types'

export const trailingSlash = 'always'

/** Expose the current user to every page for SSR rendering. */
export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.agent) {
		return { user: null }
	}

	const { agent, user } = locals
	// Enrich the bare DID with handle + avatar for the header. One getProfile per
	// request; a failure here must not break page rendering, so fall back to the DID.
	try {
		const bsky = await loadBskyProfile(agent, user.did)
		const respawn = await loadRespawnProfile(agent, user.did)

		let avatarUrl = bsky.avatarUrl
		if (respawn?.avatar) {
			const pds = await resolvePdsEndpoint(user.did as Did)
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
