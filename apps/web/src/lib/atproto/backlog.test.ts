import type { Agent } from '@atproto/api'
import { describe, expect, it, vi } from 'vitest'
import { addToBacklog, isInBacklog, migrateLegacyBacklog, removeFromBacklog } from './backlog'

const DID = 'did:plc:abc'
const BACKLOG_ITEM = 'social.respawn.backlog.item'
const LEGACY = 'social.respawn.actor.backlog'

const game = (igdbId: number) => ({ igdbId, slug: `g-${igdbId}`, title: `Game ${igdbId}` })

const notFound = () => Object.assign(new Error('Could not locate record'), { status: 400 })

interface WriteInput {
	repo: string
	collection: string
	rkey: string
	record: { createdAt: string; [key: string]: unknown }
}

/** Just enough of the repo API for the calls backlog.ts makes. */
function fakeAgent(records: Record<string, unknown> = {}) {
	const repo = {
		putRecord: vi.fn(async (_input: WriteInput) => ({})),
		deleteRecord: vi.fn(async (_input: Omit<WriteInput, 'record'>) => ({})),
		getRecord: vi.fn(async ({ collection, rkey }: { collection: string; rkey: string }) => {
			const value = records[`${collection}/${rkey}`]
			if (!value) throw notFound()
			return { data: { uri: `at://${DID}/${collection}/${rkey}`, cid: 'cid', value } }
		}),
	}
	return { agent: { com: { atproto: { repo } } } as unknown as Agent, repo }
}

describe('addToBacklog', () => {
	it('keys the record by IGDB id so re-adding is idempotent', async () => {
		const { agent, repo } = fakeAgent()

		await addToBacklog(agent, DID, { game: game(1942) })

		expect(repo.putRecord).toHaveBeenCalledTimes(1)
		const arg = repo.putRecord.mock.calls[0][0]
		expect(arg).toMatchObject({ repo: DID, collection: BACKLOG_ITEM, rkey: '1942' })
		expect(arg.record.createdAt).toEqual(expect.any(String))
	})
})

describe('removeFromBacklog', () => {
	it('deletes by IGDB id', async () => {
		const { agent, repo } = fakeAgent()

		await removeFromBacklog(agent, DID, 1942)

		expect(repo.deleteRecord).toHaveBeenCalledWith({
			repo: DID,
			collection: BACKLOG_ITEM,
			rkey: '1942',
		})
	})

	it('treats a missing record as already removed', async () => {
		const { agent, repo } = fakeAgent()
		repo.deleteRecord.mockRejectedValueOnce(notFound())

		await expect(removeFromBacklog(agent, DID, 1942)).resolves.toBeUndefined()
	})

	it('still surfaces other failures', async () => {
		const { agent, repo } = fakeAgent()
		repo.deleteRecord.mockRejectedValueOnce(new Error('upstream exploded'))

		await expect(removeFromBacklog(agent, DID, 1942)).rejects.toThrow('upstream exploded')
	})
})

describe('isInBacklog', () => {
	it('is a single getRecord rather than a full listing', async () => {
		const { agent, repo } = fakeAgent({
			[`${BACKLOG_ITEM}/1942`]: { game: game(1942), createdAt: '2026-08-01T00:00:00.000Z' },
		})

		await expect(isInBacklog(agent, DID, 1942)).resolves.toBe(true)
		await expect(isInBacklog(agent, DID, 7)).resolves.toBe(false)
		expect(repo.getRecord).toHaveBeenCalledTimes(2)
	})
})

describe('migrateLegacyBacklog', () => {
	const legacy = {
		games: [
			{ game: game(1), dateAdded: '2026-01-01T00:00:00.000Z' },
			{
				game: game(2),
				dateAdded: '2026-02-02T00:00:00.000Z',
				releaseDate: '2019-05-28T00:00:00.000Z',
			},
		],
		createdAt: '2026-01-01T00:00:00.000Z',
	}

	it('splits the self record into per-item records, preserving dateAdded', async () => {
		const { agent, repo } = fakeAgent({ [`${LEGACY}/self`]: legacy })

		await migrateLegacyBacklog(agent, DID)

		expect(repo.putRecord.mock.calls.map(([arg]) => [arg.rkey, arg.record.createdAt])).toEqual([
			['1', '2026-01-01T00:00:00.000Z'],
			['2', '2026-02-02T00:00:00.000Z'],
		])
		expect(repo.deleteRecord).toHaveBeenCalledWith({
			repo: DID,
			collection: LEGACY,
			rkey: 'self',
		})
	})

	it('does nothing when there is no legacy record', async () => {
		const { agent, repo } = fakeAgent()

		await migrateLegacyBacklog(agent, DID)

		expect(repo.putRecord).not.toHaveBeenCalled()
		expect(repo.deleteRecord).not.toHaveBeenCalled()
	})

	it('leaves the self record in place when a write fails, so the retry still sees it', async () => {
		const { agent, repo } = fakeAgent({ [`${LEGACY}/self`]: legacy })
		repo.putRecord.mockRejectedValueOnce(new Error('write failed'))

		await expect(migrateLegacyBacklog(agent, DID)).rejects.toThrow('write failed')
		expect(repo.deleteRecord).not.toHaveBeenCalled()
	})
})
