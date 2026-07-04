import { Agent } from '@atproto/api'
import type { AtprotoDid, Did } from '@atcute/lexicons/syntax'
import { resolvePdsEndpoint, resolveToDid } from '$lib/atproto/identity'

/** A resolved actor: canonical DID plus the PDS endpoint serving their repo. */
export interface ResolvedActor {
	did: string
	pds: string
	/** The handle as given, when the input was a handle rather than a DID. */
	handle?: string
}

/**
 * Resolve a handle or DID to the actor's repo location. `listRecords` /
 * `getRecord` against a PDS are public, so profile/log/list pages for any
 * actor work without auth — only cross-repo aggregation needs the appview.
 */
export async function resolveActor(input: string): Promise<ResolvedActor> {
	const trimmed = input.trim().replace(/^@/, '')
	const did = await resolveToDid(trimmed)
	const pds = await resolvePdsEndpoint(did as Did | AtprotoDid)
	if (!pds) throw new Error(`No PDS endpoint found for ${did}`)
	return { did, pds, handle: trimmed.startsWith('did:') ? undefined : trimmed }
}

/** Unauthenticated Agent pointed straight at an actor's PDS. */
export function publicAgent(pdsEndpoint: string): Agent {
	return new Agent(pdsEndpoint)
}
