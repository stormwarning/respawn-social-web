import type { RequestEvent } from '@sveltejs/kit'

/** How long a cached page stays fresh in the browser. */
const MAX_AGE_SECONDS = 60

/**
 * Let the browser reuse this page's data on a repeat visit.
 *
 * SvelteKit re-runs server loads on every client-side navigation, so returning
 * to a page you were just on costs another full round trip to the function.
 * Caching the `__data.json` response makes that navigation instant instead.
 *
 * Only call this when nothing in the payload can change as a result of what the
 * viewer themselves does — pass `viewerCanMutate` to say otherwise. An actor's
 * records are only writable by that actor, so another user's game list is safe
 * to hold; anything carrying the viewer's own follow, like or rating is not.
 *
 * `private` keeps the response out of shared caches, since the payload still
 * varies with who is signed in.
 *
 * A write is never masked by this: SvelteKit encodes invalidation state in a
 * query param, so the refetch after a form action lands on a different cache
 * key. The `viewerCanMutate` guard is what protects the *later* plain
 * navigation, which would otherwise read the pre-write copy.
 */
export function cachePageData(
	setHeaders: RequestEvent['setHeaders'],
	{ viewerCanMutate }: { viewerCanMutate: boolean },
): void {
	if (viewerCanMutate) return
	setHeaders({ 'cache-control': `private, max-age=${MAX_AGE_SECONDS}` })
}
