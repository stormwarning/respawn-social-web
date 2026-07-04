import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { getListBySlug } from '$lib/atproto/list'
import { publicAgent, resolveActor } from '$lib/atproto/public'

export const load: PageServerLoad = async ({ params }) => {
	let actor
	try {
		actor = await resolveActor(params.handle)
	} catch {
		error(404, 'Account not found')
	}

	const list = await getListBySlug(publicAgent(actor.pds), actor.did, params.slug)
	if (!list) error(404, 'List not found')

	return {
		handle: actor.handle ?? actor.did,
		name: list.value.name,
		description: list.value.description?.text ?? null,
		ranked: Boolean(list.value.ranked),
		items: (list.value.items ?? []).map((item) => item.game),
	}
}
