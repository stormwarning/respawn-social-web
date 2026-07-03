import type { Agent } from '@atproto/api'
import type { BlobRef } from '@atproto/api'
import { Collections } from '@respawn-social/lexicons'

export const RESPAWN_PROFILE_COLLECTION = Collections.profile
const RKEY = 'self'

/**
 * The Respawn profile record stored at `social.respawn.actor.profile/self` in
 * the user's repo. Mirrors the lexicon in
 * `packages/lexicons/lexicons/social/respawn/actor/profile.json`. Hand-declared
 * (rather than imported from the codegen) so the `avatar` blob lines up with
 * the @atproto/api `BlobRef` the Agent returns from uploadBlob.
 */
export interface RespawnProfileRecord {
	$type?: typeof RESPAWN_PROFILE_COLLECTION
	displayName?: string
	description?: string
	avatar?: BlobRef
	createdAt?: string
}

/** Prefill / display shape derived from either profile source. */
export interface ProfileView {
	handle: string
	displayName: string
	description: string
	/** Resolved URL for an <img>, or null when no avatar is set. */
	avatarUrl: string | null
}

/**
 * Load the Respawn profile record from the user's repo, or null if they haven't
 * created one yet.
 */
export async function loadRespawnProfile(
	agent: Agent,
	did: string,
): Promise<RespawnProfileRecord | null> {
	try {
		const res = await agent.com.atproto.repo.getRecord({
			repo: did,
			collection: RESPAWN_PROFILE_COLLECTION,
			rkey: RKEY,
		})
		return res.data.value as RespawnProfileRecord
	} catch (err) {
		if (isRecordNotFound(err)) return null
		throw err
	}
}

/** Fetch the user's existing Bluesky profile, used to prefill the Respawn one. */
export async function loadBskyProfile(agent: Agent, did: string): Promise<ProfileView> {
	const res = await agent.app.bsky.actor.getProfile({ actor: did })
	const p = res.data
	return {
		handle: p.handle,
		displayName: p.displayName ?? '',
		description: p.description ?? '',
		avatarUrl: p.avatar ?? null,
	}
}

/**
 * Build the getBlob URL for a Respawn-stored avatar on the user's PDS.
 * `pdsEndpoint` comes from `resolvePdsEndpoint(did)` in ./identity.
 */
export function avatarUrlForBlob(
	pdsEndpoint: string | undefined,
	did: string,
	avatar: BlobRef | undefined,
): string | null {
	if (!avatar || !pdsEndpoint) return null
	const cid = avatar.ref?.toString?.() ?? String(avatar.ref)
	return `${pdsEndpoint}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${cid}`
}

/** Write (create or overwrite) the Respawn profile record at `self`. */
export async function putRespawnProfile(
	agent: Agent,
	did: string,
	record: RespawnProfileRecord,
): Promise<void> {
	await agent.com.atproto.repo.putRecord({
		repo: did,
		collection: RESPAWN_PROFILE_COLLECTION,
		rkey: RKEY,
		record: { $type: RESPAWN_PROFILE_COLLECTION, ...record },
	})
}

function isRecordNotFound(err: unknown): boolean {
	const msg = err instanceof Error ? err.message : String(err)
	return /Could not locate record|RecordNotFound/i.test(msg)
}
