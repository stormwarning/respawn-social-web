/**
 * The browse URL grammar.
 *
 * Filters live in the path rather than the query string — `/games/year/2012/`,
 * `/games/decade/2010s/page/3/` — so a filtered list is a page of its own:
 * crawlable, linkable, and cached like any other. Segments come in `key/value`
 * pairs in any order; `browsePath` writes the one canonical order and the load
 * redirects anything else to it, so no list has two URLs.
 */

export interface GameFilters {
	/** A single release year. */
	year?: number
	/** The first year of a decade: 2010 for the 2010s. Exclusive with `year`. */
	decade?: number
}

export const PAGE_SIZE = 36

/** Nothing in IGDB before this is worth a page of its own. */
export const FIRST_DECADE = 1950
/** The backend's upper bound; anything past it is a typo, not a release. */
const LAST_YEAR = 2100

const inRange = (year: number) => year >= FIRST_DECADE && year <= LAST_YEAR

const YEAR = /^\d{4}$/
const DECADE = /^\d{3}0s$/
const PAGE = /^[1-9]\d*$/

/**
 * Read `[key, value, key, value, …]` into filters and a page number.
 *
 * Returns null for anything that is not a well-formed browse URL — an odd
 * number of segments, an unknown key, a key given twice, a year alongside a
 * decade, or a year outside the catalogue's range — so the route can 404
 * rather than guess or ask the backend something it will refuse.
 */
export function parseSegments(segments: string[]): { filters: GameFilters; page: number } | null {
	if (segments.length % 2 !== 0) return null

	const filters: GameFilters = {}
	let page: number | undefined

	for (let i = 0; i < segments.length; i += 2) {
		const key = segments[i]
		const value = segments[i + 1]
		switch (key) {
			case 'year':
				if (filters.year !== undefined || !YEAR.test(value)) return null
				filters.year = Number(value)
				if (!inRange(filters.year)) return null
				break
			case 'decade':
				if (filters.decade !== undefined || !DECADE.test(value)) return null
				filters.decade = Number(value.slice(0, 4))
				if (!inRange(filters.decade)) return null
				break
			case 'page':
				if (page !== undefined || !PAGE.test(value)) return null
				page = Number(value)
				break
			default:
				return null
		}
	}

	if (filters.year !== undefined && filters.decade !== undefined) return null
	return { filters, page: page ?? 1 }
}

/**
 * The canonical URL for a filtered list: filters first, then the page, with
 * page one living at the bare path. Always ends in a slash.
 */
export function browsePath(filters: GameFilters, page = 1): string {
	let path = '/games'
	if (filters.year !== undefined) path += `/year/${filters.year}`
	else if (filters.decade !== undefined) path += `/decade/${filters.decade}s`
	if (page > 1) path += `/page/${page}`
	return `${path}/`
}

/** "2012" or "2010s" — how the selection reads in the year menu. */
export function filterLabel(filters: GameFilters): string | null {
	if (filters.year !== undefined) return String(filters.year)
	if (filters.decade !== undefined) return `${filters.decade}s`
	return null
}

/** The page heading and document title. */
export function filterTitle(filters: GameFilters): string {
	if (filters.year !== undefined) return `Games from ${filters.year}`
	if (filters.decade !== undefined) return `Games from the ${filters.decade}s`
	return 'Games'
}

/** The decade a year belongs to: 2013 → 2010. */
export const decadeOf = (year: number) => year - (year % 10)
