import { fail, redirect } from '@sveltejs/kit'
import { listLinkedAccounts, unlinkAccount } from '$lib/server/backend'
import type { LinkedAccount } from '$lib/types/game'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, fetch }) => {
	if (!locals.user) redirect(303, '/login')

	let accounts: LinkedAccount[] | null
	try {
		accounts = await listLinkedAccounts(locals.user.did, fetch)
	} catch (err) {
		// Show the page with the problem stated rather than a 500: the rest of
		// settings still works without the sync service.
		console.error('[settings/connections] load failed', err)
		accounts = null
	}
	return { accounts }
}

export const actions: Actions = {
	unlink: async ({ locals, request, fetch }) => {
		if (!locals.user) redirect(303, '/login')
		const id = String((await request.formData()).get('id') ?? '')
		if (!id) return fail(400, { error: 'Missing account.' })

		try {
			await unlinkAccount(locals.user.did, id, fetch)
		} catch (err) {
			console.error('[settings/connections] unlink failed', err)
			return fail(500, { error: 'Could not disconnect. Try again.' })
		}
		return { unlinked: true }
	},
}
