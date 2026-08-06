import type { Agent } from '@atproto/api'
import {
	loadBskyProfile,
	loadRespawnProfile,
	type ProfileView,
	type RespawnProfileRecord,
} from '$lib/atproto/profile'
import { createMemo } from './memo'

/**
 * Read-through cache for a signed-in user's own profile records.
 *
 * The layout header needs both on every authenticated render, and pages like
 * `/settings/` ask for the same records again in the same request — the memo is
 * single-flight, so those concurrent callers share one upstream fetch, and a
 * warm container skips the fetch entirely.
 *
 * Write paths must keep using the uncached `$lib/atproto/profile` functions and
 * call `forgetProfile` afterwards, so an edit is never based on a stale read
 * nor followed by one.
 */
const bskyByDid = createMemo<ProfileView>({ ttlMs: 60_000 })
const respawnByDid = createMemo<RespawnProfileRecord | null>({ ttlMs: 60_000 })

export function cachedBskyProfile(agent: Agent, did: string): Promise<ProfileView> {
	return bskyByDid.get(did, () => loadBskyProfile(agent, did))
}

export function cachedRespawnProfile(
	agent: Agent,
	did: string,
): Promise<RespawnProfileRecord | null> {
	return respawnByDid.get(did, () => loadRespawnProfile(agent, did))
}

/** Drop cached reads for a DID. Call after writing that actor's profile. */
export function forgetProfile(did: string): void {
	bskyByDid.delete(did)
	respawnByDid.delete(did)
}
