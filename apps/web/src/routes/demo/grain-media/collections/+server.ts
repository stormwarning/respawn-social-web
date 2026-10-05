import { error, json } from '@sveltejs/kit'
import { publicAgent, resolveActor } from '$lib/atproto/public'
import type { RequestHandler } from './$types'

/** Which collections an actor's repo has records in. Public, like `listRecords`. */
export const GET: RequestHandler = async ({ url }) => {
	const actor = url.searchParams.get('actor')?.trim()
	if (!actor) error(400, 'Missing actor')

	let resolved
	try {
		resolved = await resolveActor(actor)
	} catch {
		error(404, `Couldn’t resolve ${actor}`)
	}

	const res = await publicAgent(resolved.pds).com.atproto.repo.describeRepo({ repo: resolved.did })
	return json({ collections: res.data.collections })
}
