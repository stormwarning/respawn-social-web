import { describe, expect, it } from 'vitest'

import { decodeCursor, encodeCursor } from '../src/api/cursor.ts'
import { buildJetstreamUrl } from '../src/ingester/jetstream.ts'

describe('feed cursor', () => {
	it('round-trips', () => {
		const createdAt = new Date('2026-07-04T12:34:56.789Z')
		const uri = 'at://did:plc:abc/social.respawn.feed.log/3jzfcijpj2z2a'
		const decoded = decodeCursor(encodeCursor(createdAt, uri))

		expect(decoded?.createdAt.getTime()).toBe(createdAt.getTime())
		expect(decoded?.uri).toBe(uri)
	})

	it('rejects garbage', () => {
		expect(decodeCursor('not-a-cursor')).toBeNull()
		expect(decodeCursor('')).toBeNull()
	})
})

describe('buildJetstreamUrl', () => {
	it('subscribes to all collections', () => {
		const url = new URL(buildJetstreamUrl('wss://jetstream.example/subscribe', null))
		const wanted = url.searchParams.getAll('wantedCollections')

		expect(wanted).toContain('social.respawn.feed.log')
		expect(wanted).toContain('social.respawn.graph.follow')
		expect(wanted.length).toBe(10)
		expect(url.searchParams.get('cursor')).toBeNull()
	})

	it('rewinds the cursor by the replay window', () => {
		const url = new URL(buildJetstreamUrl('wss://jetstream.example/subscribe', 10_000_000))

		expect(url.searchParams.get('cursor')).toBe('5000000')
	})
})
