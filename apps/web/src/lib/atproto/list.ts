import type { Agent } from '@atproto/api'
import { Collections } from '@respawn-social/lexicons'
import type { CoverRef } from '$lib/atproto/game'
import type { GameRef } from '$lib/atproto/log'
import { listAllRecords, type RecordEnvelope } from '$lib/atproto/records'

export const RESPAWN_LIST_COLLECTION = Collections.list

export interface ListItem {
	game: GameRef
	cover?: CoverRef
}

export interface RespawnListRecord {
	$type?: typeof RESPAWN_LIST_COLLECTION
	name: string
	/** URL slug, unique within the actor's repo. */
	slug: string
	description?: { text: string }
	ranked?: boolean
	items?: ListItem[]
	createdAt: string
}

/** Slugify a list name: lowercase, alphanumeric runs joined by hyphens. */
export function slugifyListName(name: string): string {
	return (
		name
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 190) || 'list'
	)
}

export async function listLists(
	agent: Agent,
	did: string,
): Promise<RecordEnvelope<RespawnListRecord>[]> {
	const lists = await listAllRecords<RespawnListRecord>(agent, did, RESPAWN_LIST_COLLECTION)
	return lists.toSorted((a, b) => (a.value.createdAt < b.value.createdAt ? 1 : -1))
}

export async function getListBySlug(
	agent: Agent,
	did: string,
	slug: string,
): Promise<RecordEnvelope<RespawnListRecord> | null> {
	const lists = await listAllRecords<RespawnListRecord>(agent, did, RESPAWN_LIST_COLLECTION)
	return lists.find((list) => list.value.slug === slug) ?? null
}

/**
 * Create a list, deduplicating the slug against existing lists in the repo
 * (`my-list`, `my-list-2`, …).
 */
export async function createList(
	agent: Agent,
	did: string,
	{ name, description, ranked }: { name: string; description?: string; ranked?: boolean },
): Promise<{ uri: string; slug: string }> {
	const existing = await listLists(agent, did)
	const taken = new Set(existing.map((list) => list.value.slug))
	const base = slugifyListName(name)
	let slug = base
	for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`

	const record: RespawnListRecord = {
		$type: RESPAWN_LIST_COLLECTION,
		name,
		slug,
		description: description ? { text: description } : undefined,
		ranked: ranked || undefined,
		items: [],
		createdAt: new Date().toISOString(),
	}
	const res = await agent.com.atproto.repo.createRecord({
		repo: did,
		collection: RESPAWN_LIST_COLLECTION,
		record: { ...record },
	})
	return { uri: res.data.uri, slug }
}

/** Overwrite a list record (e.g. after editing items). */
export async function putList(
	agent: Agent,
	did: string,
	rkey: string,
	record: RespawnListRecord,
): Promise<void> {
	await agent.com.atproto.repo.putRecord({
		repo: did,
		collection: RESPAWN_LIST_COLLECTION,
		rkey,
		record: { $type: RESPAWN_LIST_COLLECTION, ...record },
	})
}

export async function deleteList(agent: Agent, did: string, rkey: string): Promise<void> {
	await agent.com.atproto.repo.deleteRecord({
		repo: did,
		collection: RESPAWN_LIST_COLLECTION,
		rkey,
	})
}
