import { json } from '@sveltejs/kit'
import type { Did } from '@atcute/lexicons/syntax'
import { listGrainRecords, type GrainRepoData } from '$lib/atproto/grain'
import { resolvePdsEndpoint } from '$lib/atproto/identity'
import { toPlainRecord } from '$lib/atproto/records'
import type { RequestHandler } from './$types'

/** The signed-in viewer's Grain galleries and photos, for the log dialog's picker. */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user || !locals.agent) return json({ error: 'unauthorized' }, { status: 401 })
	const { agent, timings, user } = locals

	try {
		const [records, pds, described] = await timings.track('grain.repo', () =>
			Promise.all([
				listGrainRecords(agent, user.did),
				resolvePdsEndpoint(user.did as Did),
				agent.com.atproto.repo.describeRepo({ repo: user.did }),
			]),
		)
		if (!pds) return json({ error: 'unavailable' }, { status: 503 })
		const repo: GrainRepoData = {
			did: user.did,
			handle: described.data.handle,
			pds,
			...toPlainRecord(records),
		}
		return json(repo, { headers: { 'cache-control': 'private, no-store' } })
	} catch (err) {
		console.error('[api/viewer/grain/repo] failed', err)
		return json({ error: 'unavailable' }, { status: 503 })
	}
}
