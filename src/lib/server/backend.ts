import { env } from '$env/dynamic/private'

/** Minimal game shape returned by the backend IGDB proxy. Refine when the
 * backend contract is finalised. */
export interface Game {
	id: number
	name: string
	summary?: string
	cover?: { url: string }
	[key: string]: unknown
}

function baseUrl(): string {
	const url = env.BACKEND_API_URL
	if (!url) throw new Error('BACKEND_API_URL is not set')
	return url.replace(/\/$/, '')
}

/**
 * Typed fetch wrapper over the respawn-social-backend API service. Call only
 * from server load/endpoint code (SSR). `fetch` is SvelteKit's event fetch when
 * passed, enabling request-scoped caching/relative resolution.
 */
async function api<T>(path: string, fetchFn: typeof fetch = fetch): Promise<T> {
	const res = await fetchFn(`${baseUrl()}${path}`, {
		headers: { accept: 'application/json' },
	})
	if (!res.ok) {
		throw new Error(`backend ${path} -> ${res.status} ${res.statusText}`)
	}
	return res.json() as Promise<T>
}

export async function getGame(id: string | number, fetchFn?: typeof fetch): Promise<Game> {
	const { game } = await api<{ game: Game }>(`/games/${id}`, fetchFn)
	return game
}

export async function searchGames(query: string, fetchFn?: typeof fetch): Promise<Game[]> {
	const { results } = await api<{ results: Game[] }>(
		`/games/search?q=${encodeURIComponent(query)}`,
		fetchFn,
	)
	return results
}
