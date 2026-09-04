import { env } from '$env/dynamic/private'
import type { SearchHit, Title } from '$lib/types/game'

function baseUrl(): string {
	const url = env.BACKEND_API_URL
	if (!url) throw new Error('BACKEND_API_URL is not set')
	return url.replace(/\/$/, '')
}

/**
 * A failed backend call, carrying enough detail to tell the two cases apart.
 *
 * This distinction matters more than it looks. Without it a load can only
 * catch "something went wrong" and render a 404, which means a backend that is
 * down looks exactly like a game that does not exist — the page says "Game not
 * found" and nobody goes looking for a dead service.
 */
export class BackendError extends Error {
	/** The backend's status, or 0 when we never got a response. */
	readonly status: number
	/** True when the backend could not be reached at all. */
	readonly unreachable: boolean

	constructor(path: string, status: number, detail: string) {
		super(`backend ${path} -> ${status || 'unreachable'} ${detail}`)
		this.name = 'BackendError'
		this.status = status
		this.unreachable = status === 0
	}

	/** The game genuinely is not there, as opposed to us being unable to ask. */
	get isNotFound(): boolean {
		return this.status === 404
	}
}

/**
 * Typed fetch wrapper over the respawn-social-backend API service. Call only
 * from server load/endpoint code (SSR). `fetch` is SvelteKit's event fetch when
 * passed, enabling request-scoped caching/relative resolution.
 */
async function api<T>(path: string, fetchFn: typeof fetch = fetch): Promise<T> {
	let res: Response
	try {
		res = await fetchFn(`${baseUrl()}${path}`, {
			headers: { accept: 'application/json' },
		})
	} catch (err) {
		// Connection refused, DNS failure, timeout — the backend is not answering.
		throw new BackendError(path, 0, err instanceof Error ? err.message : String(err))
	}

	if (!res.ok) {
		throw new BackendError(path, res.status, res.statusText)
	}
	return res.json() as Promise<T>
}

/**
 * Fetch a title by any IGDB game id, including a folded child's.
 *
 * The backend resolves the id through its member table, so an id saved before a
 * game folded into its parent still returns the right page. Check
 * `title.resolvedFrom` to know it happened.
 */
export async function getTitle(id: string | number, fetchFn?: typeof fetch): Promise<Title> {
	const { title } = await api<{ title: Title }>(`/games/${id}`, fetchFn)
	return title
}

export async function getTitleBySlug(slug: string, fetchFn?: typeof fetch): Promise<Title> {
	const { title } = await api<{ title: Title }>(`/games/slug/${encodeURIComponent(slug)}`, fetchFn)
	return title
}

/**
 * Every IGDB id that resolves to a title.
 *
 * Used to gather a viewer's records for a game whose DLC or editions they may
 * have logged separately before those folded in.
 */
export async function getMembers(
	id: string | number,
	fetchFn?: typeof fetch,
): Promise<{ titleId: number; memberIds: number[] }> {
	return api<{ titleId: number; memberIds: number[] }>(`/games/${id}/members`, fetchFn)
}

export async function searchTitles(
	query: string,
	fetchFn?: typeof fetch,
	limit?: number,
): Promise<SearchHit[]> {
	const params = new URLSearchParams({ q: query })
	if (limit) params.set('limit', String(limit))
	const { results } = await api<{ results: SearchHit[] }>(`/games/search?${params}`, fetchFn)
	return results
}
