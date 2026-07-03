import { json } from '@sveltejs/kit'
import { getOAuthClient } from '$lib/server/oauth/client'
import type { RequestHandler } from './$types'

/** Serve the public JWKS for the confidential client (private_key_jwt). */
export const GET: RequestHandler = async () => {
	const client = await getOAuthClient()
	return json(client.jwks)
}
