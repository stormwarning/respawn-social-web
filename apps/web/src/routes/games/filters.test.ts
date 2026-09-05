import { describe, expect, it } from 'vitest'
import { browsePath, decadeOf, filterLabel, filterTitle, parseSegments } from './filters'

describe('parseSegments', () => {
	it('reads the bare path as the unfiltered first page', () => {
		expect(parseSegments([])).toEqual({ filters: {}, page: 1 })
	})

	it('reads a year, a decade, and a page in any order', () => {
		expect(parseSegments(['year', '2012'])).toEqual({ filters: { year: 2012 }, page: 1 })
		expect(parseSegments(['decade', '2010s'])).toEqual({ filters: { decade: 2010 }, page: 1 })
		expect(parseSegments(['year', '2012', 'page', '3'])).toEqual({
			filters: { year: 2012 },
			page: 3,
		})
		expect(parseSegments(['page', '3', 'decade', '1990s'])).toEqual({
			filters: { decade: 1990 },
			page: 3,
		})
	})

	it('rejects an odd number of segments', () => {
		expect(parseSegments(['year'])).toBeNull()
		expect(parseSegments(['year', '2012', 'page'])).toBeNull()
	})

	it('rejects unknown keys', () => {
		expect(parseSegments(['genre', 'rpg'])).toBeNull()
	})

	it('rejects malformed values', () => {
		expect(parseSegments(['year', '12'])).toBeNull()
		expect(parseSegments(['year', '2012s'])).toBeNull()
		expect(parseSegments(['decade', '2010'])).toBeNull()
		expect(parseSegments(['decade', '2015s'])).toBeNull()
		expect(parseSegments(['page', '0'])).toBeNull()
		expect(parseSegments(['page', '01'])).toBeNull()
		expect(parseSegments(['page', 'two'])).toBeNull()
	})

	it('rejects years outside the catalogue', () => {
		expect(parseSegments(['year', '1852'])).toBeNull()
		expect(parseSegments(['year', '2101'])).toBeNull()
		expect(parseSegments(['decade', '1940s'])).toBeNull()
		expect(parseSegments(['year', '1950'])).toEqual({ filters: { year: 1950 }, page: 1 })
	})

	it('rejects a repeated key', () => {
		expect(parseSegments(['year', '2012', 'year', '2013'])).toBeNull()
		expect(parseSegments(['page', '2', 'page', '3'])).toBeNull()
	})

	it('rejects a year combined with a decade', () => {
		expect(parseSegments(['year', '2012', 'decade', '2010s'])).toBeNull()
	})
})

describe('browsePath', () => {
	it('puts page one at the bare path', () => {
		expect(browsePath({})).toBe('/games/')
		expect(browsePath({}, 1)).toBe('/games/')
		expect(browsePath({ year: 2012 })).toBe('/games/year/2012/')
		expect(browsePath({ decade: 2010 })).toBe('/games/decade/2010s/')
	})

	it('appends later pages after the filters', () => {
		expect(browsePath({}, 2)).toBe('/games/page/2/')
		expect(browsePath({ year: 2012 }, 3)).toBe('/games/year/2012/page/3/')
		expect(browsePath({ decade: 2010 }, 3)).toBe('/games/decade/2010s/page/3/')
	})

	it('round-trips what parseSegments reads', () => {
		for (const segments of [
			['year', '2012', 'page', '3'],
			['decade', '1990s'],
			['page', '7'],
		]) {
			const parsed = parseSegments(segments)!
			expect(browsePath(parsed.filters, parsed.page)).toBe(`/games/${segments.join('/')}/`)
		}
	})
})

describe('labels', () => {
	it('names the selection', () => {
		expect(filterLabel({})).toBeNull()
		expect(filterLabel({ year: 2012 })).toBe('2012')
		expect(filterLabel({ decade: 2010 })).toBe('2010s')
	})

	it('titles the page', () => {
		expect(filterTitle({})).toBe('Games')
		expect(filterTitle({ year: 2012 })).toBe('Games from 2012')
		expect(filterTitle({ decade: 2010 })).toBe('Games from the 2010s')
	})

	it('finds the decade of a year', () => {
		expect(decadeOf(2013)).toBe(2010)
		expect(decadeOf(2010)).toBe(2010)
		expect(decadeOf(1999)).toBe(1990)
	})
})
