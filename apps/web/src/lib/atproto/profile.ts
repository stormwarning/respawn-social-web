import type { Agent } from '@atproto/api'
import type { BlobRef } from '@atproto/api'
import { Collections } from '@respawn-social/lexicons'

export const RESPAWN_PROFILE_COLLECTION = Collections.profile
const RKEY = 'self'

export const MAX_AVATAR_BYTES = 1_000_000
export const ACCEPTED_AVATAR_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

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
	pronouns?: string
	/** The actor's favorite games, max 4. */
	faves?: Array<{
		game: { igdbId: number; slug: string; title: string }
		cover?: { image: BlobRef; colors?: { dominant?: string } }
	}>
	/** URL of the actor's streaming or video channel. */
	channel?: string
	/** DID of the actor's Bluesky account. */
	bsky?: string
	/** How to display adult content to profile visitors; clients default to blur. */
	adultContent?: 'show' | 'blur' | 'hide'
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
 * Build the getBlob URL for any Respawn-stored blob on the user's PDS.
 * `pdsEndpoint` comes from `resolvePdsEndpoint(did)` in ./identity.
 */
export function blobUrl(
	pdsEndpoint: string | undefined,
	did: string,
	blob: BlobRef | undefined,
): string | null {
	if (!blob || !pdsEndpoint) return null
	// `ref` is a CID instance on a record straight from the Agent, and a plain
	// `{$link}` object once the record has been through `toPlainRecord`.
	const ref = blob.ref as { $link?: string } | undefined
	const cid = ref?.$link ?? blob.ref?.toString?.() ?? String(blob.ref)
	return `${pdsEndpoint}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${cid}`
}

/** Build the getBlob URL for a Respawn-stored avatar on the user's PDS. */
export function avatarUrlForBlob(
	pdsEndpoint: string | undefined,
	did: string,
	avatar: BlobRef | undefined,
): string | null {
	return blobUrl(pdsEndpoint, did, avatar)
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

/**
 * Copy a Bluesky avatar into the user's repo as a blob. The Respawn lexicon
 * stores the avatar as a blob, so the CDN image has to be re-uploaded rather
 * than referenced by URL. Returns undefined when the image is missing,
 * unsupported, oversized, or the upload fails.
 */
async function mirrorBskyAvatar(agent: Agent, avatarUrl: string): Promise<BlobRef | undefined> {
	try {
		const res = await fetch(avatarUrl)
		if (!res.ok) return undefined

		const mime = (res.headers.get('content-type') ?? '').split(';')[0].trim()
		if (!ACCEPTED_AVATAR_TYPES.has(mime)) return undefined

		const bytes = new Uint8Array(await res.arrayBuffer())
		if (bytes.byteLength > MAX_AVATAR_BYTES) return undefined

		const upload = await agent.com.atproto.repo.uploadBlob(bytes, { encoding: mime })
		return upload.data.blob
	} catch (err) {
		console.error('[profile] avatar mirror failed', err)
		return undefined
	}
}

/**
 * Seed the Respawn profile record from the user's Bluesky profile at sign-in.
 * Idempotent: existing fields are never overwritten, and a record that already
 * has an avatar short-circuits before any network work.
 */
export async function ensureRespawnProfile(agent: Agent, did: string): Promise<void> {
	const existing = await loadRespawnProfile(agent, did)
	if (existing?.avatar) return

	const bsky = await loadBskyProfile(agent, did)
	const avatar = bsky.avatarUrl ? await mirrorBskyAvatar(agent, bsky.avatarUrl) : undefined

	const record: RespawnProfileRecord = {
		...existing,
		displayName: existing?.displayName ?? (bsky.displayName || undefined),
		avatar,
		createdAt: existing?.createdAt ?? new Date().toISOString(),
	}

	if (existing && !avatar && record.displayName === existing.displayName) return

	await putRespawnProfile(agent, did, record)
}

function isRecordNotFound(err: unknown): boolean {
	const msg = err instanceof Error ? err.message : String(err)
	return /Could not locate record|RecordNotFound/i.test(msg)
}
