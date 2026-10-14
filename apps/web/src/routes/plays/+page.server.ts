import { fail, redirect } from '@sveltejs/kit'
import { listDetectedPlays, listLinkedAccounts, resolveDetectedPlay } from '$lib/server/backend'
import type { DetectedPlay, LinkedAccount } from '$lib/types/game'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, fetch }) => {
	if (!locals.user) redirect(303, '/login')
	const { did } = locals.user

	let plays: DetectedPlay[] | null
	let accounts: LinkedAccount[] = []
	try {
		;[plays, accounts] = await Promise.all([
			listDetectedPlays(did, fetch),
			listLinkedAccounts(did, fetch),
		])
	} catch (err) {
		console.error('[plays] load failed', err)
		plays = null
	}
	return { plays, hasAccounts: accounts.length > 0 }
}

export const actions: Actions = {
	dismiss: async ({ locals, request, fetch }) => {
		if (!locals.user) redirect(303, '/login')
		const id = String((await request.formData()).get('id') ?? '')
		if (!id) return fail(400, { error: 'Missing play.' })

		try {
			await resolveDetectedPlay(locals.user.did, id, { status: 'dismissed' }, fetch)
		} catch (err) {
			console.error('[plays] dismiss failed', err)
			return fail(500, { error: 'Could not dismiss. Try again.' })
		}
		return { dismissed: id }
	},
}
