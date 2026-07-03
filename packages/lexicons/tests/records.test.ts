import { describe, expect, it } from 'vitest'

import { Collections, social } from '../src/index.ts'

const createdAt = '2026-07-03T12:00:00.000Z'
const game = { igdbId: 1234, slug: 'outer-wilds', title: 'Outer Wilds' }
const did = 'did:plc:ewvi7nxzyoun6zhxrhs64oiz'
const strongRef = {
	uri: `at://${did}/social.respawn.feed.log/3jzfcijpj2z2a`,
	cid: 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
}

describe('social.respawn.feed.log', () => {
	const schema = social.respawn.feed.log.main

	it('accepts a full log record', () => {
		expect(
			schema.$safeParse({
				$type: Collections.log,
				game,
				platform: 'PC',
				edition: 'Archaeologist Edition',
				dlc: ['Echoes of the Eye'],
				datePlayed: createdAt,
				startedPlaying: true,
				finishedPlaying: 'completed',
				rating: 10,
				liked: true,
				review: {
					text: 'A perfect loop. ███████████.',
					textWithSpoilers: 'A perfect loop. The eye awaits.',
					containsSpoilers: false,
					facets: [
						{
							index: { byteStart: 16, byteEnd: 30 },
							features: [{ $type: 'social.respawn.richtext.facet#spoiler' }],
						},
					],
				},
				createdAt,
			}).success,
		).toBe(true)
	})

	it('requires game and createdAt', () => {
		expect(schema.$safeParse({ $type: Collections.log, createdAt }).success).toBe(false)
		expect(schema.$safeParse({ $type: Collections.log, game }).success).toBe(false)
	})

	it('rejects out-of-range ratings', () => {
		expect(schema.$safeParse({ $type: Collections.log, game, rating: 11, createdAt }).success).toBe(
			false,
		)
		expect(schema.$safeParse({ $type: Collections.log, game, rating: 0, createdAt }).success).toBe(
			false,
		)
	})

	it('accepts unknown play states (knownValues is an open enum)', () => {
		const result = schema.$safeParse({
			$type: Collections.log,
			game,
			finishedPlaying: 'rage-quit',
			createdAt,
		})
		// knownValues is an open enum; unknown strings still validate at the lexicon level.
		expect(result.success).toBe(true)
	})
})

describe('social.respawn.feed.like', () => {
	const schema = social.respawn.feed.like.main

	it('accepts a like of a strong ref', () => {
		expect(
			schema.$safeParse({ $type: Collections.like, subject: strongRef, createdAt }).success,
		).toBe(true)
	})

	it('requires a subject', () => {
		expect(schema.$safeParse({ $type: Collections.like, createdAt }).success).toBe(false)
	})
})

describe('social.respawn.feed.comment', () => {
	const schema = social.respawn.feed.comment.main

	it('accepts a comment with a parent', () => {
		expect(
			schema.$safeParse({
				$type: Collections.comment,
				text: 'Same, the ending wrecked me.',
				subject: strongRef,
				parent: strongRef,
				createdAt,
			}).success,
		).toBe(true)
	})

	it('requires text and subject', () => {
		expect(schema.$safeParse({ $type: Collections.comment, createdAt }).success).toBe(false)
	})
})

describe('social.respawn.feed.gate', () => {
	const schema = social.respawn.feed.gate.main

	it('accepts allow rules and hidden comments', () => {
		expect(
			schema.$safeParse({
				$type: Collections.gate,
				subject: strongRef.uri,
				allow: [{ $type: 'social.respawn.feed.gate#followingRule' }],
				disableLikes: true,
				hiddenComments: [strongRef.uri],
				createdAt,
			}).success,
		).toBe(true)
	})

	it('accepts an empty allow array (nobody)', () => {
		expect(
			schema.$safeParse({ $type: Collections.gate, subject: strongRef.uri, allow: [], createdAt })
				.success,
		).toBe(true)
	})
})

describe('social.respawn.graph', () => {
	it('accepts follow and block records', () => {
		for (const [nsid, schema] of [
			[Collections.follow, social.respawn.graph.follow.main],
			[Collections.block, social.respawn.graph.block.main],
		] as const) {
			expect(schema.$safeParse({ $type: nsid, subject: did, createdAt }).success).toBe(true)
			expect(schema.$safeParse({ $type: nsid, subject: 'not-a-did', createdAt }).success).toBe(
				false,
			)
		}
	})
})

describe('social.respawn.game', () => {
	const schema = social.respawn.game.main

	it('accepts a collection entry', () => {
		expect(
			schema.$safeParse({
				$type: Collections.game,
				rating: 8,
				liked: true,
				playing: false,
				played: 'completed',
				createdAt,
			}).success,
		).toBe(true)
	})
})

describe('social.respawn.list', () => {
	const schema = social.respawn.list.main

	it('accepts a ranked list', () => {
		expect(
			schema.$safeParse({
				$type: Collections.list,
				name: 'Games of the Decade',
				slug: 'games-of-the-decade',
				ranked: true,
				description: { text: 'The ten that stuck.' },
				items: [{ game }],
				createdAt,
			}).success,
		).toBe(true)
	})

	it('requires a slug', () => {
		expect(schema.$safeParse({ $type: Collections.list, name: 'No slug', createdAt }).success).toBe(
			false,
		)
	})
})

describe('social.respawn.actor.profile', () => {
	const schema = social.respawn.actor.profile.main

	it('accepts the extended profile fields', () => {
		expect(
			schema.$safeParse({
				$type: Collections.profile,
				displayName: 'Jeff',
				pronouns: 'he/him',
				faves: [{ game }],
				channel: 'https://twitch.tv/example',
				bsky: did,
				adultContent: 'blur',
				createdAt,
			}).success,
		).toBe(true)
	})

	it('limits faves to four', () => {
		expect(
			schema.$safeParse({
				$type: Collections.profile,
				faves: Array.from({ length: 5 }, () => ({ game })),
				createdAt,
			}).success,
		).toBe(false)
	})
})

describe('social.respawn.actor.backlog', () => {
	const schema = social.respawn.actor.backlog.main

	it('accepts backlog items', () => {
		expect(
			schema.$safeParse({
				$type: Collections.backlog,
				games: [{ game, dateAdded: createdAt, releaseDate: '2019-05-28T00:00:00.000Z' }],
				createdAt,
			}).success,
		).toBe(true)
	})

	it('requires dateAdded per item', () => {
		expect(
			schema.$safeParse({ $type: Collections.backlog, games: [{ game }], createdAt }).success,
		).toBe(false)
	})
})
