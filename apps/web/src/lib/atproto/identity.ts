import {
	CompositeDidDocumentResolver,
	CompositeHandleResolver,
	PlcDidDocumentResolver,
	WebDidDocumentResolver,
	WellKnownHandleResolver,
} from '@atcute/identity-resolver'
import { NodeDnsHandleResolver } from '@atcute/identity-resolver-node'
import { getPdsEndpoint } from '@atcute/identity'
import { isDid, isHandle, type AtprotoDid, type Did } from '@atcute/lexicons/syntax'
import { createMemo } from '$lib/server/memo'

// Both lookups sit on the critical path of every actor page, and neither answer
// changes often: a handle keeps its DID until the owner re-points it, and a DID
// keeps its PDS until the repo migrates. Caching them removes two network hops
// per request on a warm container.
const didByHandle = createMemo<Did | AtprotoDid>({ ttlMs: 5 * 60_000 })
const pdsByDid = createMemo<string | undefined>({ ttlMs: 15 * 60_000 })
const handleByDid = createMemo<string | null>({ ttlMs: 15 * 60_000 })

const handleResolver = new CompositeHandleResolver({
	strategy: 'race',
	methods: {
		dns: new NodeDnsHandleResolver(),
		http: new WellKnownHandleResolver(),
	},
})

export const docResolver = new CompositeDidDocumentResolver({
	methods: {
		plc: new PlcDidDocumentResolver(),
		web: new WebDidDocumentResolver(),
	},
})

/**
 * Resolve a handle or DID to a DID. The OAuth client also resolves handles
 * internally during `authorize()`; this helper is for places where we need the
 * DID up front (e.g. lookups, display) without starting an auth flow.
 */
export async function resolveToDid(input: string): Promise<Did | AtprotoDid> {
	const value = input.trim().replace(/^@/, '')
	if (isDid(value)) return value
	if (isHandle(value)) return didByHandle.get(value, () => handleResolver.resolve(value))
	throw new Error(`Not a valid handle or DID: ${input}`)
}

/**
 * Reverse of `resolveToDid`, for display: the handle a DID claims in its
 * document. Unverified — good enough for labelling feed rows, not for auth.
 */
export async function resolveHandleForDid(did: string): Promise<string | null> {
	return handleByDid.get(did, async () => {
		const doc = await docResolver.resolve(did as AtprotoDid)
		const aka = doc.alsoKnownAs?.find((uri) => uri.startsWith('at://'))
		return aka ? aka.slice('at://'.length) : null
	})
}

/**
 * Resolve a DID's PDS service endpoint from its DID document. Needed to build
 * blob URLs (`com.atproto.sync.getBlob`) for records stored on the user's repo,
 * since the authed Agent does not expose its service origin.
 */
export async function resolvePdsEndpoint(did: Did | AtprotoDid): Promise<string | undefined> {
	const pds = await pdsByDid.get(did, async () => {
		const doc = await docResolver.resolve(did as AtprotoDid)
		return getPdsEndpoint(doc)
	})
	// A DID document that resolved but named no PDS is usually a transient blip
	// upstream; don't let it poison the cache for the full TTL.
	if (!pds) pdsByDid.delete(did)
	return pds
}
