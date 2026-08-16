import { describe, expect, it } from 'vitest'
import { parseFaves } from './faves'

const fave = (igdbId: number, extra: Record<string, unknown> = {}) => ({
	igdbId,
	slug: `game-${igdbId}`,
	title: `Game ${igdbId}`,
	rawCoverUrl: '//images.igdb.com/igdb/image/upload/t_thumb/co1.jpg',
	...extra,
})

describe('parseFaves', () => {
	it('treats an empty value as no favourites', () => {
		expect(parseFaves('')).toEqual([])
		expect(parseFaves('   ')).toEqual([])
		expect(parseFaves('[]')).toEqual([])
	})

	it('keeps the posted order', () => {
		const parsed = parseFaves(JSON.stringify([fave(3), fave(1), fave(2)]))
		expect(parsed).toEqual([
			{ igdbId: 3, slug: 'game-3', title: 'Game 3', rawCoverUrl: expect.any(String) },
			{ igdbId: 1, slug: 'game-1', title: 'Game 1', rawCoverUrl: expect.any(String) },
			{ igdbId: 2, slug: 'game-2', title: 'Game 2', rawCoverUrl: expect.any(String) },
		])
	})

	it('normalises a missing cover url to null', () => {
		const parsed = parseFaves(JSON.stringify([fave(1, { rawCoverUrl: null })]))
		expect(parsed).toEqual([{ igdbId: 1, slug: 'game-1', title: 'Game 1', rawCoverUrl: null }])
	})

	it('drops duplicate games', () => {
		const parsed = parseFaves(JSON.stringify([fave(1), fave(2), fave(1)]))
		expect(parsed).toHaveLength(2)
		expect(parsed).toEqual([
			expect.objectContaining({ igdbId: 1 }),
			expect.objectContaining({ igdbId: 2 }),
		])
	})

	it('rejects malformed JSON', () => {
		expect(parseFaves('{')).toEqual({ error: 'Invalid favourites.' })
	})

	it('rejects a non-array payload', () => {
		expect(parseFaves('{"igdbId":1}')).toEqual({ error: 'Invalid favourites.' })
	})

	it('rejects more than four favourites', () => {
		const parsed = parseFaves(JSON.stringify([fave(1), fave(2), fave(3), fave(4), fave(5)]))
		expect(parsed).toEqual({ error: 'You can have at most 4 favourites.' })
	})

	it.each([
		['a non-integer id', fave(1, { igdbId: 1.5 })],
		['a zero id', fave(1, { igdbId: 0 })],
		['a missing slug', fave(1, { slug: '' })],
		['an over-long slug', fave(1, { slug: 'x'.repeat(201) })],
		['a missing title', fave(1, { title: '   ' })],
		['an over-long title', fave(1, { title: 'x'.repeat(2001) })],
		['a non-string cover url', fave(1, { rawCoverUrl: 42 })],
	])('rejects %s', (_label, entry) => {
		expect(parseFaves(JSON.stringify([entry]))).toEqual({ error: 'Invalid favourites.' })
	})
})
