import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FeedItem } from '$lib/server/appview'
import type { ResolveResult } from '$lib/types/game'

const resolveIds = vi.fn()
vi.mock('$lib/server/backend', () => ({ resolveIds }))
vi.mock('$lib/atproto/identity', () => ({
	resolveHandleForDid: async (did: string) => (did === 'did:plc:sam' ? 'sam.test' : null),
	resolvePdsEndpoint: async () => undefined,
}))

const { hydrateFeed, isUnreleased, logPath } = await import('./feed')

const NOW = new Date('2026-10-02T12:00:00Z')
const result = (firstReleaseDate?: string | null): ResolveResult => ({
	titleId: 1,
	status: 'live',
	via: 'members',
	firstReleaseDate,
})

describe('isUnreleased', () => {
	it('holds back a game releasing later', () => {
		expect(isUnreleased(result('2026-11-01T00:00:00.000Z'), NOW)).toBe(true)
	})

	it('lets through a game already out', () => {
		expect(isUnreleased(result('2026-10-01T00:00:00.000Z'), NOW)).toBe(false)
	})

	it('treats a TBA title as unreleased', () => {
		expect(isUnreleased(result(null), NOW)).toBe(true)
	})

	it('has nothing to wait on for an unmirrored id or an old backend', () => {
		expect(isUnreleased({ titleId: null, status: 'deleted', via: 'unknown' }, NOW)).toBe(false)
		expect(isUnreleased(result(undefined), NOW)).toBe(false)
		expect(isUnreleased(undefined, NOW)).toBe(false)
	})
})

describe('logPath', () => {
	it('puts the first log at the bare game path', () => {
		expect(logPath('sam.test', 'hades', 1)).toBe('/sam.test/game/hades/')
	})

	it('numbers later logs', () => {
		expect(logPath('sam.test', 'hades', 3)).toBe('/sam.test/game/hades/3/')
	})
})

describe('hydrateFeed', () => {
	const game = (igdbId: number, slug: string) => ({ igdbId, slug, title: slug })
	const log = (igdbId: number, slug: string, number = 1): FeedItem => ({
		type: 'log',
		uri: `at://did:plc:sam/social.respawn.feed.log/${slug}`,
		did: 'did:plc:sam',
		createdAt: '2026-10-01T00:00:00Z',
		game: game(igdbId, slug),
		log: {
			uri: `at://did:plc:sam/social.respawn.feed.log/${slug}`,
			did: 'did:plc:sam',
			number,
			record: { game: game(igdbId, slug), createdAt: '2026-10-01T00:00:00Z' },
		},
	})
	const follow: FeedItem = {
		type: 'follow',
		uri: 'at://did:plc:sam/social.respawn.graph.follow/f',
		did: 'did:plc:sam',
		createdAt: '2026-10-01T00:00:00Z',
		subject: 'did:plc:me',
	}

	beforeEach(() => {
		resolveIds.mockReset()
		vi.spyOn(console, 'error').mockImplementation(() => {})
	})

	it('drops logs of unreleased games and keeps the cursor', async () => {
		resolveIds.mockResolvedValue({
			1: result('2020-01-01T00:00:00.000Z'),
			2: result('2099-01-01T00:00:00.000Z'),
		})
		const feed = await hydrateFeed({
			feed: [log(1, 'hades', 2), log(2, 'future'), follow],
			cursor: 'c',
		})
		expect(feed.items.map((item) => item.type)).toEqual(['log', 'follow'])
		expect(feed.items[0].log?.url).toBe('/sam.test/game/hades/2/')
		expect(feed.cursor).toBe('c')
	})

	it('skips the release check when the page has no logs', async () => {
		await hydrateFeed({ feed: [follow], cursor: null })
		expect(resolveIds).not.toHaveBeenCalled()
	})

	it('keeps logs when the backend is down rather than emptying the feed', async () => {
		resolveIds.mockRejectedValue(new Error('unreachable'))
		const feed = await hydrateFeed({ feed: [log(2, 'future')], cursor: null })
		expect(feed.items).toHaveLength(1)
	})
})
