import sharp from 'sharp'
import type { Agent } from '@atproto/api'
import { normalizeCoverUrl } from '$lib/server/igdb'
import type { CoverRef } from '$lib/atproto/game'

const toHex = (n: number) => n.toString(16).padStart(2, '0')

/**
 * Fetch a game's IGDB cover, extract its dominant color, and upload the image as a
 * blob to the user's PDS. Returns the blob ref plus the dominant color as a hex string.
 *
 * The first time a game is marked played this runs fetch + sharp, so that toggle is a
 * little slower; later un/re-toggles reuse the stored cover and skip this entirely.
 */
export async function buildCover(agent: Agent, rawCoverUrl: string): Promise<CoverRef> {
	const res = await fetch(normalizeCoverUrl(rawCoverUrl))
	if (!res.ok) throw new Error(`cover fetch failed: ${res.status}`)
	const buf = Buffer.from(await res.arrayBuffer())

	const { dominant } = await sharp(buf).stats()
	const hex = `#${toHex(dominant.r)}${toHex(dominant.g)}${toHex(dominant.b)}`

	const upload = await agent.com.atproto.repo.uploadBlob(new Uint8Array(buf), {
		encoding: res.headers.get('content-type') ?? 'image/jpeg',
	})

	return { image: upload.data.blob, colors: { dominant: hex } }
}
