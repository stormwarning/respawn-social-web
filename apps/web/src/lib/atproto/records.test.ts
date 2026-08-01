import { BlobRef, jsonToLex } from '@atproto/api'
import { describe, expect, it } from 'vitest'
import { toPlainRecord } from './records'
import { blobUrl } from './profile'

const CID_STR = 'bafkreibk7ebiuohwvyaekcijrvkekyjd5sbipmjtlbxn5msywdohzaory4'

/** A record as the Agent hands it back: blobs hydrated into BlobRef instances. */
const recordFromAgent = (): { displayName: string; avatar: BlobRef } =>
	jsonToLex({
		displayName: 'Ada',
		avatar: {
			$type: 'blob',
			ref: { $link: CID_STR },
			mimeType: 'image/jpeg',
			size: 19470,
		},
	}) as { displayName: string; avatar: BlobRef }

/** What devalue — and so SvelteKit's load serialization — accepts. */
function isPlainDeep(value: unknown): boolean {
	if (Array.isArray(value)) return value.every(isPlainDeep)
	if (value === null || typeof value !== 'object') return true
	if (Object.getPrototypeOf(value) !== Object.prototype) return false
	return Object.values(value).every(isPlainDeep)
}

describe('toPlainRecord', () => {
	it('makes a record with a blob serializable by SvelteKit', () => {
		const record = recordFromAgent()

		// Returned as-is from a load, this fails the page with
		// "Cannot stringify arbitrary non-POJOs".
		expect(record.avatar).toBeInstanceOf(BlobRef)
		expect(isPlainDeep(record)).toBe(false)

		expect(isPlainDeep(toPlainRecord(record))).toBe(true)
	})

	it('keeps the canonical blob shape', () => {
		expect(toPlainRecord(recordFromAgent()).avatar).toEqual({
			$type: 'blob',
			ref: { $link: CID_STR },
			mimeType: 'image/jpeg',
			size: 19470,
		})
	})
})

describe('blobUrl', () => {
	it('builds the same URL before and after toPlainRecord', () => {
		const did = 'did:plc:example'
		const record = recordFromAgent()
		const fromAgent = blobUrl('https://pds.example', did, record.avatar)

		expect(fromAgent).toContain(`cid=${CID_STR}`)
		expect(blobUrl('https://pds.example', did, toPlainRecord(record).avatar)).toBe(fromAgent)
	})
})
