import { describe, expect, it } from 'vitest'
import { mergeGameRecords } from './title-identity'
import type { RespawnGameRecord } from './game'

/**
 * Merging is the one place in the fold handling where a user can silently lose
 * something they did. The rules exist so that cannot happen, and these pin them.
 */

const record = (partial: Partial<RespawnGameRecord> = {}): RespawnGameRecord => ({
	createdAt: '2024-01-01T00:00:00.000Z',
	...partial,
})

describe('mergeGameRecords', () => {
	it('returns null for nothing', () => {
		expect(mergeGameRecords([])).toBeNull()
	})

	it('passes a single record through untouched', () => {
		const only = record({ rating: 8, liked: true })
		expect(mergeGameRecords([only])).toBe(only)
	})

	it('keeps the newest rating', () => {
		const merged = mergeGameRecords([
			record({ createdAt: '2023-01-01T00:00:00.000Z', rating: 6 }),
			record({ createdAt: '2025-01-01T00:00:00.000Z', rating: 9 }),
		])
		// A rating is an opinion that can change; the later one is current.
		expect(merged?.rating).toBe(9)
	})

	it('keeps an older rating rather than none', () => {
		const merged = mergeGameRecords([
			record({ createdAt: '2023-01-01T00:00:00.000Z', rating: 6 }),
			record({ createdAt: '2025-01-01T00:00:00.000Z', liked: true }),
		])
		// The newer record has no rating, which is not the same as rating it zero.
		expect(merged?.rating).toBe(6)
	})

	it('keeps the newest played state', () => {
		const merged = mergeGameRecords([
			record({ createdAt: '2023-01-01T00:00:00.000Z', played: 'played' }),
			record({ createdAt: '2025-01-01T00:00:00.000Z', played: 'completed' }),
		])
		expect(merged?.played).toBe('completed')
	})

	it('ORs liked and playing across every record', () => {
		const merged = mergeGameRecords([
			record({ createdAt: '2023-01-01T00:00:00.000Z', liked: true }),
			record({ createdAt: '2025-01-01T00:00:00.000Z', playing: true }),
		])
		// Marking either on any record means the user meant it. Nothing in the UI
		// distinguishes "unset" from "false", so a newer record must not clear it.
		expect(merged?.liked).toBe(true)
		expect(merged?.playing).toBe(true)
	})

	it('leaves liked and playing undefined when nobody set them', () => {
		const merged = mergeGameRecords([record({ rating: 5 }), record({ rating: 6 })])
		expect(merged?.liked).toBeUndefined()
		expect(merged?.playing).toBeUndefined()
	})

	it('keeps whichever cover exists', () => {
		const cover = { image: { ref: 'blob' } } as unknown as RespawnGameRecord['cover']
		const merged = mergeGameRecords([
			record({ createdAt: '2025-01-01T00:00:00.000Z' }),
			record({ createdAt: '2023-01-01T00:00:00.000Z', cover }),
		])
		// Rebuilding a cover means re-uploading a blob to the PDS, so never drop
		// one just because the newer record lacks it.
		expect(merged?.cover).toBe(cover)
	})

	it('keeps the earliest createdAt', () => {
		const merged = mergeGameRecords([
			record({ createdAt: '2025-01-01T00:00:00.000Z' }),
			record({ createdAt: '2023-01-01T00:00:00.000Z' }),
		])
		// When this user first recorded an interest in the title, not when the
		// most recent of their records happened to be written.
		expect(merged?.createdAt).toBe('2023-01-01T00:00:00.000Z')
	})

	it('keeps a game ref from whichever record has one', () => {
		const game = { igdbId: 1942, slug: 'the-witcher-3-wild-hunt', title: 'The Witcher 3' }
		const merged = mergeGameRecords([
			record({ createdAt: '2025-01-01T00:00:00.000Z' }),
			record({ createdAt: '2023-01-01T00:00:00.000Z', game }),
		])
		expect(merged?.game).toEqual(game)
	})

	it('loses nothing when a DLC record and a base-game record combine', () => {
		// The real scenario: rated the DLC in 2023, liked and started the base
		// game in 2025. Everything the user expressed has to survive.
		const merged = mergeGameRecords([
			record({ createdAt: '2023-06-01T00:00:00.000Z', rating: 9, played: 'completed' }),
			record({ createdAt: '2025-02-01T00:00:00.000Z', liked: true, playing: true }),
		])
		expect(merged).toEqual({
			game: undefined,
			rating: 9,
			played: 'completed',
			liked: true,
			playing: true,
			cover: undefined,
			createdAt: '2023-06-01T00:00:00.000Z',
		})
	})
})
