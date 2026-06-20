import { json } from '@sveltejs/kit'
import { getClientMetadata } from '$lib/server/oauth/client'
import type { RequestHandler } from './$types'

/** Serve the OAuth client metadata document referenced by client_id. */
export const GET: RequestHandler = () => {
	return json(getClientMetadata())
}
