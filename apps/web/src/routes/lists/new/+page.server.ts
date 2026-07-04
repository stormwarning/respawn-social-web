import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { createList } from '$lib/atproto/list'

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.agent) redirect(303, '/login')
	return {}
}

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user || !locals.agent) redirect(303, '/login')
		const { agent, user } = locals

		const form = await request.formData()
		const name = String(form.get('name') ?? '').trim()
		const description = String(form.get('description') ?? '').trim()
		const ranked = form.get('ranked') === 'on'
		if (!name) return fail(400, { error: 'A list needs a name.' })

		let slug: string
		try {
			;({ slug } = await createList(agent, user.did, {
				name,
				description: description || undefined,
				ranked,
			}))
		} catch (err) {
			console.error('[lists/new] create failed', err)
			return fail(500, { error: 'Could not create the list. Try again.' })
		}

		redirect(303, `/${user.handle ?? user.did}/list/${slug}/`)
	},
}
