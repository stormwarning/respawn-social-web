import { error, json } from '@sveltejs/kit'
import { publicAgent, resolveActor } from '$lib/atproto/public'
import { listGrainRecords, type GrainRepoData } from '$lib/atproto/grain'
import { toPlainRecord } from '$lib/atproto/records'
import type { RequestHandler } from './$types'

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

	const records = await listGrainRecords(publicAgent(resolved.pds), resolved.did)
	const repo: GrainRepoData = {
		did: resolved.did,
		handle: resolved.handle ?? resolved.did,
		pds: resolved.pds,
		...toPlainRecord(records),
	}
	return json(repo)
}
