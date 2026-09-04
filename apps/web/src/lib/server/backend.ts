import { env } from '$env/dynamic/private'
import type { SearchHit, Title } from '$lib/types/game'

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
