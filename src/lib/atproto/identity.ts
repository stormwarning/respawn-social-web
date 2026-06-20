import {
	CompositeDidDocumentResolver,
	CompositeHandleResolver,
	PlcDidDocumentResolver,
	WebDidDocumentResolver,
	WellKnownHandleResolver,
} from '@atcute/identity-resolver'
import { NodeDnsHandleResolver } from '@atcute/identity-resolver-node'
import { isDid, isHandle, type AtprotoDid, type Did } from '@atcute/lexicons/syntax'

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
	if (isHandle(value)) return handleResolver.resolve(value)
	throw new Error(`Not a valid handle or DID: ${input}`)
}
