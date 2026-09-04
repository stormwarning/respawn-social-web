import type { Agent } from '@atproto/api'
import { getCoverColors } from '$lib/server/backend'
import { normalizeCoverUrl } from '$lib/server/igdb'
import type { CoverRef } from '$lib/atproto/game'

/**
 * IGDB image ids are content addressed: the id changes when the art does. That
 * is what lets the backend compute a cover's colours once and share the answer
 * with everyone, instead of every user's first click decoding the same image.
 */
function imageIdFrom(url: string): string | null {
	const match = /\/([a-z0-9]+)\.(?:jpg|png|webp)(?:\?.*)?$/i.exec(url)
	return match?.[1] ?? null
}

/**
 * Fetch a game's IGDB cover, upload it as a blob to the user's PDS, and attach
 * the dominant colour the backend already worked out.
 *
 * The colour used to be extracted here with `sharp`, on the request that marked
 * a game played — an image decode on a user's click, repeated per user per
 * game, and a native dependency in the SvelteKit build for the sake of one
 * number. It now comes from `GET /covers/:imageId/colors`, computed once.
 *
 * The colour is best-effort: a cover with no colour still uploads. Failing the
 * whole action because a tint is unavailable would be the wrong trade.
 */
export async function buildCover(
	agent: Agent,
	rawCoverUrl: string,
	fetchFn?: typeof fetch,
): Promise<CoverRef> {
	const url = normalizeCoverUrl(rawCoverUrl)

	const imageId = imageIdFrom(url)
	const [uploaded, dominant] = await Promise.all([
		uploadCoverBlob(agent, url),
		imageId ? dominantColor(imageId, fetchFn) : Promise.resolve(null),
	])

	return dominant ? { ...uploaded, colors: { dominant } } : uploaded
}

/**
 * Upload a cover blob without asking for its colour.
 *
 * Used by the favourites selector, where covers are only ever rendered as
 * images and nothing tints behind them.
 */
export async function uploadCover(agent: Agent, rawCoverUrl: string): Promise<CoverRef> {
	return uploadCoverBlob(agent, normalizeCoverUrl(rawCoverUrl))
}

async function uploadCoverBlob(agent: Agent, url: string): Promise<CoverRef> {
	const res = await fetch(url)
	if (!res.ok) throw new Error(`cover fetch failed: ${res.status}`)
	const bytes = new Uint8Array(await res.arrayBuffer())

	const upload = await agent.com.atproto.repo.uploadBlob(bytes, {
		encoding: res.headers.get('content-type') ?? 'image/jpeg',
	})

	return { image: upload.data.blob }
}

async function dominantColor(imageId: string, fetchFn?: typeof fetch): Promise<string | null> {
	try {
		return (await getCoverColors(imageId, fetchFn))?.dominant ?? null
	} catch (err) {
		console.error('[cover] colour lookup failed; saving without one', err)
		return null
	}
}
