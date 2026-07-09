import { and, eq, sql } from 'drizzle-orm'
import { Collections, social } from '@respawn-social/lexicons'
import type { Db } from '../db/client.ts'
import {
	actors,
	backlogs,
	blocks,
	comments,
	follows,
	gameEntries,
	gates,
	likes,
	lists,
	logs,
} from '../db/schema.ts'

/** Jetstream event shapes (subset we consume). */
export interface JetstreamEvent {
	did: string
	time_us: number
	kind: 'commit' | 'identity' | 'account'
	commit?: {
		rev: string
		operation: 'create' | 'update' | 'delete'
		collection: string
		rkey: string
		record?: Record<string, unknown>
		cid?: string
	}
	identity?: { did: string; handle?: string }
	account?: { did: string; active: boolean; status?: string }
}

const RECORD_SCHEMAS: Record<string, { $safeParse: (v: unknown) => { success: boolean } }> = {
	[Collections.game]: social.respawn.game.main,
	[Collections.list]: social.respawn.list.main,
	[Collections.log]: social.respawn.feed.log.main,
	[Collections.like]: social.respawn.feed.like.main,
	[Collections.comment]: social.respawn.feed.comment.main,
	[Collections.gate]: social.respawn.feed.gate.main,
	[Collections.follow]: social.respawn.graph.follow.main,
	[Collections.block]: social.respawn.graph.block.main,
	[Collections.profile]: social.respawn.actor.profile.main,
	[Collections.backlog]: social.respawn.actor.backlog.main,
}

const atUri = (did: string, collection: string, rkey: string) => `at://${did}/${collection}/${rkey}`

const asDate = (value: unknown): Date => {
	const d = new Date(typeof value === 'string' ? value : 0)
	return Number.isNaN(d.getTime()) ? new Date(0) : d
}

const LOG_URI_SEGMENT = `/${Collections.log}/`

export async function handleEvent(db: Db, event: JetstreamEvent): Promise<void> {
	switch (event.kind) {
		case 'commit':
			return handleCommit(db, event)
		case 'identity':
			if (event.identity?.handle) {
				await db
					.insert(actors)
					.values({ did: event.did, handle: event.identity.handle })
					.onConflictDoUpdate({
						target: actors.did,
						set: { handle: event.identity.handle, indexedAt: new Date() },
					})
			}
			return
		case 'account':
			if (event.account && !event.account.active) {
				await purgeActor(db, event.did)
			} else if (event.account?.active) {
				await db
					.update(actors)
					.set({ active: true, indexedAt: new Date() })
					.where(eq(actors.did, event.did))
			}
			return
	}
}

/** Deactivation / takedown: keep the actor row (inactive), drop all content. */
export async function purgeActor(db: Db, did: string): Promise<void> {
	await db.transaction(async (tx) => {
		await tx
			.insert(actors)
			.values({ did, active: false })
			.onConflictDoUpdate({ target: actors.did, set: { active: false, indexedAt: new Date() } })
		await tx.delete(gameEntries).where(eq(gameEntries.did, did))
		await tx.delete(logs).where(eq(logs.did, did))
		await tx.delete(likes).where(eq(likes.did, did))
		await tx.delete(comments).where(eq(comments.did, did))
		await tx.delete(gates).where(eq(gates.did, did))
		await tx.delete(follows).where(eq(follows.did, did))
		await tx.delete(blocks).where(eq(blocks.did, did))
		await tx.delete(lists).where(eq(lists.did, did))
		await tx.delete(backlogs).where(eq(backlogs.did, did))
	})
}

async function ensureActor(db: Db, did: string): Promise<void> {
	await db.insert(actors).values({ did }).onConflictDoNothing()
}

async function handleCommit(db: Db, event: JetstreamEvent): Promise<void> {
	const commit = event.commit
	if (!commit) return
	const { collection, rkey, operation } = commit
	if (!(collection in RECORD_SCHEMAS)) return

	if (operation === 'delete') {
		return deleteRecord(db, event.did, collection, rkey)
	}

	const record = commit.record
	if (!record) return
	const result = RECORD_SCHEMAS[collection].$safeParse({ $type: collection, ...record })
	if (!result.success) {
		console.warn(`[ingester] invalid ${collection} record from ${event.did}/${rkey}, skipping`)
		return
	}

	await ensureActor(db, event.did)
	await indexRecord(db, event.did, collection, rkey, commit.cid ?? '', record)
}

/* oxlint-disable no-fallthrough -- each case returns */
export async function indexRecord(
	db: Db,
	did: string,
	collection: string,
	rkey: string,
	cid: string,
	record: Record<string, unknown>,
): Promise<void> {
	const uri = atUri(did, collection, rkey)
	const createdAt = asDate(record.createdAt)

	switch (collection) {
		case Collections.game: {
			const igdbId = Number(rkey)
			if (!Number.isInteger(igdbId)) return
			const values = {
				did,
				igdbId,
				rating: (record.rating as number) ?? null,
				liked: (record.liked as boolean) ?? null,
				playing: (record.playing as boolean) ?? null,
				played: (record.played as string) ?? null,
				record,
				createdAt,
				indexedAt: new Date(),
			}
			await db
				.insert(gameEntries)
				.values(values)
				.onConflictDoUpdate({ target: [gameEntries.did, gameEntries.igdbId], set: values })
			return
		}
		case Collections.log: {
			const game = record.game as { igdbId?: number; slug?: string; title?: string } | undefined
			const review = record.review as { text?: string } | undefined
			const values = {
				cid,
				did,
				rkey,
				igdbId: game?.igdbId ?? 0,
				slug: game?.slug ?? '',
				title: game?.title ?? '',
				rating: (record.rating as number) ?? null,
				liked: (record.liked as boolean) ?? null,
				finishedPlaying: (record.finishedPlaying as string) ?? null,
				hasReview: Boolean(review?.text),
				record,
				createdAt,
				indexedAt: new Date(),
			}
			await db
				.insert(logs)
				.values({ uri, ...values })
				.onConflictDoUpdate({ target: logs.uri, set: values })
			return
		}
		case Collections.like: {
			const subject = record.subject as { uri?: string; cid?: string } | undefined
			if (!subject?.uri) return
			await db.transaction(async (tx) => {
				const inserted = await tx
					.insert(likes)
					.values({
						uri,
						did,
						subjectUri: subject.uri!,
						subjectCid: subject.cid ?? null,
						createdAt,
					})
					.onConflictDoNothing({ target: likes.uri })
					.returning({ uri: likes.uri })
				if (inserted.length > 0 && subject.uri!.includes(LOG_URI_SEGMENT)) {
					await tx
						.update(logs)
						.set({ likeCount: sql`${logs.likeCount} + 1` })
						.where(eq(logs.uri, subject.uri!))
				}
			})
			return
		}
		case Collections.comment: {
			const subject = record.subject as { uri?: string } | undefined
			const parent = record.parent as { uri?: string } | undefined
			if (!subject?.uri) return
			await db.transaction(async (tx) => {
				const inserted = await tx
					.insert(comments)
					.values({
						uri,
						did,
						subjectUri: subject.uri!,
						parentUri: parent?.uri ?? null,
						text: String(record.text ?? ''),
						record,
						createdAt,
					})
					.onConflictDoUpdate({
						target: comments.uri,
						set: { text: String(record.text ?? ''), record, indexedAt: new Date() },
					})
					.returning({ indexedAt: comments.indexedAt })
				// Count only fresh inserts (updates keep the count).
				const isFresh = inserted.length > 0 && subject.uri!.includes(LOG_URI_SEGMENT)
				if (isFresh) {
					await tx
						.update(logs)
						.set({
							commentCount: sql`(select count(*) from comments where subject_uri = ${subject.uri!})`,
						})
						.where(eq(logs.uri, subject.uri!))
				}
			})
			return
		}
		case Collections.gate: {
			const allow = record.allow as Array<{ $type?: string }> | undefined
			const values = {
				did,
				rkey,
				subjectUri: String(record.subject ?? ''),
				allow: allow ? allow.map((rule) => rule.$type?.split('#')[1] ?? '') : null,
				disableLikes: Boolean(record.disableLikes),
				hiddenComments: (record.hiddenComments as string[]) ?? null,
				record,
				indexedAt: new Date(),
			}
			await db
				.insert(gates)
				.values({ uri, ...values })
				.onConflictDoUpdate({ target: gates.uri, set: values })
			return
		}
		case Collections.follow:
		case Collections.block: {
			const table = collection === Collections.follow ? follows : blocks
			await db
				.insert(table)
				.values({ uri, did, subjectDid: String(record.subject ?? ''), createdAt })
				.onConflictDoNothing({ target: table.uri })
			return
		}
		case Collections.list: {
			const items = (record.items as unknown[]) ?? []
			const values = {
				did,
				rkey,
				name: String(record.name ?? ''),
				slug: String(record.slug ?? ''),
				ranked: Boolean(record.ranked),
				itemCount: items.length,
				record,
				createdAt,
				indexedAt: new Date(),
			}
			await db
				.insert(lists)
				.values({ uri, ...values })
				.onConflictDoUpdate({ target: lists.uri, set: values })
			return
		}
		case Collections.profile: {
			const avatar = record.avatar as { ref?: { $link?: string } } | undefined
			const values = {
				displayName: (record.displayName as string) ?? null,
				avatarCid: avatar?.ref?.$link ?? null,
				profile: record,
				indexedAt: new Date(),
			}
			await db
				.insert(actors)
				.values({ did, ...values })
				.onConflictDoUpdate({ target: actors.did, set: values })
			return
		}
		case Collections.backlog: {
			const games = (record.games as unknown[]) ?? []
			const values = { gameCount: games.length, record, indexedAt: new Date() }
			await db
				.insert(backlogs)
				.values({ did, ...values })
				.onConflictDoUpdate({ target: backlogs.did, set: values })
			return
		}
	}
}
/* oxlint-enable no-fallthrough */

export async function deleteRecord(
	db: Db,
	did: string,
	collection: string,
	rkey: string,
): Promise<void> {
	const uri = atUri(did, collection, rkey)

	switch (collection) {
		case Collections.game: {
			const igdbId = Number(rkey)
			if (!Number.isInteger(igdbId)) return
			await db
				.delete(gameEntries)
				.where(and(eq(gameEntries.did, did), eq(gameEntries.igdbId, igdbId)))
			return
		}
		case Collections.log:
			await db.delete(logs).where(eq(logs.uri, uri))
			return
		case Collections.like: {
			await db.transaction(async (tx) => {
				const removed = await tx
					.delete(likes)
					.where(eq(likes.uri, uri))
					.returning({ subjectUri: likes.subjectUri })
				const subjectUri = removed[0]?.subjectUri
				if (subjectUri?.includes(LOG_URI_SEGMENT)) {
					await tx
						.update(logs)
						.set({ likeCount: sql`greatest(${logs.likeCount} - 1, 0)` })
						.where(eq(logs.uri, subjectUri))
				}
			})
			return
		}
		case Collections.comment: {
			await db.transaction(async (tx) => {
				const removed = await tx
					.delete(comments)
					.where(eq(comments.uri, uri))
					.returning({ subjectUri: comments.subjectUri })
				const subjectUri = removed[0]?.subjectUri
				if (subjectUri?.includes(LOG_URI_SEGMENT)) {
					await tx
						.update(logs)
						.set({ commentCount: sql`greatest(${logs.commentCount} - 1, 0)` })
						.where(eq(logs.uri, subjectUri))
				}
			})
			return
		}
		case Collections.gate:
			await db.delete(gates).where(eq(gates.uri, uri))
			return
		case Collections.follow:
			await db.delete(follows).where(eq(follows.uri, uri))
			return
		case Collections.block:
			await db.delete(blocks).where(eq(blocks.uri, uri))
			return
		case Collections.list:
			await db.delete(lists).where(eq(lists.uri, uri))
			return
		case Collections.profile:
			await db
				.update(actors)
				.set({ displayName: null, avatarCid: null, profile: null, indexedAt: new Date() })
				.where(eq(actors.did, did))
			return
		case Collections.backlog:
			await db.delete(backlogs).where(eq(backlogs.did, did))
			return
	}
}
