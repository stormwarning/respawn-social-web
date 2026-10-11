import { env } from '$env/dynamic/private'
import type {
	BrowseResult,
	CoverColors,
	DetectedPlay,
	LinkedAccount,
	ResolveResult,
	SearchHit,
	Title,
} from '$lib/types/game'

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

/**
 * Where do these saved ids point now?
 *
 * Batched: a profile page holds a hundred records and one request each would
 * cost more than rendering the page. The backend caps a request at 200 ids, so
 * anything larger is chunked here rather than failing.
 */
const RESOLVE_CHUNK = 200

export async function resolveIds(
	ids: number[],
	fetchFn?: typeof fetch,
): Promise<Record<string, ResolveResult>> {
	const unique = [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0)
	if (unique.length === 0) return {}

	const out: Record<string, ResolveResult> = {}
	for (let i = 0; i < unique.length; i += RESOLVE_CHUNK) {
		const chunk = unique.slice(i, i + RESOLVE_CHUNK)
		const { resolved } = await api<{ resolved: Record<string, ResolveResult> }>(
			`/games/resolve?ids=${chunk.join(',')}`,
			fetchFn,
		)
		Object.assign(out, resolved)
	}
	return out
}

/**
 * A cover's colours, computed once by the backend and shared.
 *
 * Returns null for a cover with none — a missing image, or one that could not
 * be decoded. Callers treat a tint as optional, which it is.
 */
export async function getCoverColors(
	imageId: string,
	fetchFn?: typeof fetch,
): Promise<CoverColors | null> {
	try {
		return await api<CoverColors>(`/covers/${encodeURIComponent(imageId)}/colors`, fetchFn)
	} catch (err) {
		if (err instanceof BackendError && err.isNotFound) return null
		throw err
	}
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

export interface BrowseQuery {
	/** A single release year. */
	year?: number
	/** The first year of a decade: 2010 for the 2010s. Exclusive with `year`. */
	decade?: number
	page: number
	limit: number
}

/** A page of the catalogue, most popular first, optionally within a year or decade. */
export async function browseTitles(
	query: BrowseQuery,
	fetchFn?: typeof fetch,
): Promise<BrowseResult> {
	const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit) })
	if (query.year !== undefined) params.set('year', String(query.year))
	if (query.decade !== undefined) params.set('decade', String(query.decade))
	return api<BrowseResult>(`/games/browse?${params}`, fetchFn)
}

/**
 * Play sync: linked gaming accounts and the plays noticed on them.
 *
 * Unlike the game routes these act on one user's data, and the backend takes
 * the did on trust from us. `INTERNAL_API_SECRET` is what proves the caller is
 * this server, so these must only ever run server-side, with a did that came
 * from the signed-in session.
 */
async function syncApi<T>(
	method: 'GET' | 'POST' | 'DELETE',
	path: string,
	body?: unknown,
	fetchFn: typeof fetch = fetch,
): Promise<T> {
	const secret = env.INTERNAL_API_SECRET
	if (!secret) throw new Error('INTERNAL_API_SECRET is not set')

	let res: Response
	try {
		res = await fetchFn(`${baseUrl()}/sync${path}`, {
			method,
			headers: {
				accept: 'application/json',
				'X-Internal-Secret': secret,
				...(body === undefined ? {} : { 'content-type': 'application/json' }),
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		})
	} catch (err) {
		throw new BackendError(path, 0, err instanceof Error ? err.message : String(err))
	}

	if (!res.ok) throw new BackendError(path, res.status, res.statusText)
	return (res.status === 204 ? undefined : await res.json()) as T
}

export async function listLinkedAccounts(
	did: string,
	fetchFn?: typeof fetch,
): Promise<LinkedAccount[]> {
	const { accounts } = await syncApi<{ accounts: LinkedAccount[] }>(
		'GET',
		`/accounts?did=${encodeURIComponent(did)}`,
		undefined,
		fetchFn,
	)
	return accounts
}

/**
 * Link an account. The backend runs the first sync before answering, so the
 * returned status already says whether the library is visible. A 409 means
 * another user linked it first.
 */
export async function linkAccount(
	did: string,
	provider: LinkedAccount['provider'],
	externalId: string,
	fetchFn?: typeof fetch,
): Promise<LinkedAccount> {
	const { account } = await syncApi<{ account: LinkedAccount }>(
		'POST',
		'/accounts',
		{ did, provider, externalId },
		fetchFn,
	)
	return account
}

export async function unlinkAccount(
	did: string,
	id: string,
	fetchFn?: typeof fetch,
): Promise<void> {
	await syncApi<void>(
		'DELETE',
		`/accounts/${encodeURIComponent(id)}?did=${encodeURIComponent(did)}`,
		undefined,
		fetchFn,
	)
}

export async function listDetectedPlays(
	did: string,
	fetchFn?: typeof fetch,
): Promise<DetectedPlay[]> {
	const { plays } = await syncApi<{ plays: DetectedPlay[] }>(
		'GET',
		`/plays?did=${encodeURIComponent(did)}`,
		undefined,
		fetchFn,
	)
	return plays
}

export async function resolveDetectedPlay(
	did: string,
	id: string,
	resolution: { status: 'logged'; logUri: string } | { status: 'dismissed' },
	fetchFn?: typeof fetch,
): Promise<void> {
	await syncApi<void>(
		'POST',
		`/plays/${encodeURIComponent(id)}/resolve`,
		{ did, ...resolution },
		fetchFn,
	)
}
