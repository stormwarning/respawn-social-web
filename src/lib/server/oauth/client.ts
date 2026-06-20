import { NodeOAuthClient, type OAuthClientMetadataInput } from '@atproto/oauth-client-node'
import { JoseKey } from '@atproto/jwk-jose'
import { env } from '$env/dynamic/private'
import { sessionStore, stateStore } from './blob-store'

const SCOPE = 'atproto transition:generic'

/**
 * In production, APP_URL points at the deployed origin and the client is a
 * confidential client (private_key_jwt) with hosted metadata + JWKS.
 *
 * In dev (APP_URL unset), we use the AT Protocol loopback client convention:
 * client_id is a `http://localhost` URL carrying redirect_uri + scope as query
 * params, so no hosted metadata is required. Loopback redirect hosts must be
 * 127.0.0.1 / [::1] per spec.
 */
function buildMetadata(): { metadata: OAuthClientMetadataInput; isLoopback: boolean } {
	const publicUrl = env.APP_URL?.replace(/\/$/, '')

	if (!publicUrl) {
		const redirectUri = 'http://127.0.0.1:5173/oauth/callback'
		const clientId =
			`http://localhost` +
			`?redirect_uri=${encodeURIComponent(redirectUri)}` +
			`&scope=${encodeURIComponent(SCOPE)}`
		return {
			isLoopback: true,
			metadata: {
				client_id: clientId,
				client_name: 'Respawn Social (dev)',
				redirect_uris: [redirectUri],
				scope: SCOPE,
				grant_types: ['authorization_code', 'refresh_token'],
				response_types: ['code'],
				application_type: 'web',
				token_endpoint_auth_method: 'none',
				dpop_bound_access_tokens: true,
			},
		}
	}

	return {
		isLoopback: false,
		metadata: {
			client_id: `${publicUrl}/oauth/client-metadata.json`,
			client_name: 'Respawn Social',
			client_uri: publicUrl,
			redirect_uris: [`${publicUrl}/oauth/callback`],
			scope: SCOPE,
			grant_types: ['authorization_code', 'refresh_token'],
			response_types: ['code'],
			application_type: 'web',
			token_endpoint_auth_method: 'private_key_jwt',
			token_endpoint_auth_signing_alg: 'ES256',
			dpop_bound_access_tokens: true,
			jwks_uri: `${publicUrl}/oauth/jwks.json`,
		},
	}
}

let cached: NodeOAuthClient | null = null

export async function getOAuthClient(): Promise<NodeOAuthClient> {
	if (cached) return cached

	const { metadata, isLoopback } = buildMetadata()

	// Confidential client needs a signing keyset; loopback dev client does not.
	const keyset =
		!isLoopback && env.PRIVATE_JWK
			? [await JoseKey.fromImportable(env.PRIVATE_JWK, 'key1')]
			: undefined

	cached = new NodeOAuthClient({
		clientMetadata: metadata,
		keyset,
		stateStore,
		sessionStore,
	})

	return cached
}

/** Exposed so the metadata + jwks routes serve exactly what the client uses. */
export function getClientMetadata(): OAuthClientMetadataInput {
	return buildMetadata().metadata
}
