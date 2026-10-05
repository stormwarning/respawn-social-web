import { error, json } from '@sveltejs/kit'
import { publicAgent, resolveActor } from '$lib/atproto/public'
import { listAllRecords, toPlainRecord } from '$lib/atproto/records'
import type { RequestHandler } from './$types'

const COLLECTIONS = ['social.grain.gallery', 'social.grain.gallery.item', 'social.grain.photo']

/**
 * Read an actor's Grain records straight from their PDS. No session is used:
 * `listRecords` is a public read, which is the point the demo makes.
 */
export const GET: RequestHandler = async ({ url }) => {
	const actor = url.searchParams.get('actor')?.trim()
	if (!actor) error(400, 'Missing actor')

	let resolved
	try {
		resolved = await resolveActor(actor)
	} catch {
		error(404, `Couldn’t resolve ${actor}`)
	}

	const agent = publicAgent(resolved.pds)
	const [galleries, items, photos] = await Promise.all(
		COLLECTIONS.map((collection) => listAllRecords(agent, resolved.did, collection, { max: 500 })),
	)

	return json(
		toPlainRecord({
			did: resolved.did,
			handle: resolved.handle ?? resolved.did,
			pds: resolved.pds,
			galleries,
			items,
			photos,
		}),
	)
}
