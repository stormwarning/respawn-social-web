import { fail, redirect } from '@sveltejs/kit'
import { getOAuthClient } from '$lib/server/oauth/client'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(303, '/')
	return {}
}

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData()
		const handle = String(form.get('handle') ?? '').trim()
		if (!handle) {
			return fail(400, { error: 'Enter a handle or DID.' })
		}

		let authUrl: URL
		try {
			const client = await getOAuthClient()
			// authorize() resolves the handle/DID, stores flow state, and returns
			// the PDS authorization URL to redirect to.
			authUrl = await client.authorize(handle, { scope: 'atproto transition:generic' })
		} catch (err) {
			console.error('[login] authorize failed', err)
			return fail(400, { error: 'Could not start login. Check the handle and try again.' })
		}

		redirect(303, authUrl.toString())
	},
}
