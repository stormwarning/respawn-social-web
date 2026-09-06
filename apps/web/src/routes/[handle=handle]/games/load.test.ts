import { describe, expect, it } from 'vitest'
import { sortByReleaseDate } from './load'

describe('sortByReleaseDate', () => {
	it('sorts newest releases first and leaves games without a release date last', () => {
		const games = [
			{ title: 'Unknown', releaseDate: undefined, sortedAt: '2026-03-01T00:00:00.000Z' },
			{
				title: 'Oldest',
				releaseDate: '1998-11-20T00:00:00.000Z',
				sortedAt: '2026-03-03T00:00:00.000Z',
			},
			{
				title: 'Newest',
				releaseDate: '2025-10-02T00:00:00.000Z',
				sortedAt: '2026-03-02T00:00:00.000Z',
			},
		]

		expect(sortByReleaseDate(games).map(({ title }) => title)).toEqual([
			'Newest',
			'Oldest',
			'Unknown',
		])
	})

	it('uses recent activity to make equal and unknown release dates deterministic', () => {
		const games = [
			{ title: 'Older activity', releaseDate: null, sortedAt: '2025-01-01T00:00:00.000Z' },
			{ title: 'Newer activity', releaseDate: null, sortedAt: '2026-01-01T00:00:00.000Z' },
		]

		expect(sortByReleaseDate(games).map(({ title }) => title)).toEqual([
			'Newer activity',
			'Older activity',
		])
	})

	it('compares release dates chronologically when they use different offsets', () => {
		const games = [
			{
				title: 'Earlier instant',
				releaseDate: '2025-01-01T00:30:00+02:00',
				sortedAt: '2026-01-01T00:00:00.000Z',
			},
			{
				title: 'Later instant',
				releaseDate: '2024-12-31T23:00:00Z',
				sortedAt: '2025-01-01T00:00:00.000Z',
			},
		]

		expect(sortByReleaseDate(games).map(({ title }) => title)).toEqual([
			'Later instant',
			'Earlier instant',
		])
	})
})
