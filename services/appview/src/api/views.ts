import { and, desc, eq, inArray, lt, or, sql, type SQL } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { actors, blocks, comments, follows, gates, likes, logs } from '../db/schema.ts'
import { decodeCursor, encodeCursor } from './cursor.ts'

export interface ActorView {
	did: string
	handle: string | null
	displayName: string | null
	avatarCid: string | null
}

export interface LogView {
	uri: string
	cid: string
	author: ActorView
	record: unknown
	likeCount: number
	commentCount: number
	createdAt: string
	viewer?: { like: string | null }
}

export interface FeedPage {
	feed: LogView[]
	cursor: string | null
}

const actorColumns = {
	did: actors.did,
	handle: actors.handle,
	displayName: actors.displayName,
	avatarCid: actors.avatarCid,
}

/** DIDs the viewer blocks or is blocked by. */
async function blockedDids(db: Db, viewer: string): Promise<string[]> {
	const rows = await db
		.select({ did: blocks.did, subjectDid: blocks.subjectDid })
		.from(blocks)
		.where(or(eq(blocks.did, viewer), eq(blocks.subjectDid, viewer)))
	const out = new Set<string>()
	for (const row of rows) out.add(row.did === viewer ? row.subjectDid : row.did)
	return [...out]
}

async function hydrateViewerLikes(db: Db, viewer: string | null, views: LogView[]): Promise<void> {
	if (!viewer || views.length === 0) return
	const rows = await db
		.select({ uri: likes.uri, subjectUri: likes.subjectUri })
		.from(likes)
		.where(
			and(
				eq(likes.did, viewer),
				inArray(
					likes.subjectUri,
					views.map((v) => v.uri),
				),
			),
		)
	const byy = new Map(rows.map((row) => [row.subjectUri, row.uri]))
	for (const view of views) view.viewer = { like: byy.get(view.uri) ?? null }
}

async function logPage(
	db: Db,
	where: SQL | undefined,
	viewer: string | null,
	limit: number,
	cursor: string | null,
): Promise<FeedPage> {
	const decoded = cursor ? decodeCursor(cursor) : null
	const pageWhere = decoded
		? and(
				where,
				or(
					lt(logs.createdAt, decoded.createdAt),
					and(eq(logs.createdAt, decoded.createdAt), lt(logs.uri, decoded.uri)),
				),
			)
		: where

	const rows = await db
		.select({
			uri: logs.uri,
			cid: logs.cid,
			record: logs.record,
			likeCount: logs.likeCount,
			commentCount: logs.commentCount,
			createdAt: logs.createdAt,
			author: actorColumns,
		})
		.from(logs)
		.innerJoin(actors, eq(actors.did, logs.did))
		.where(pageWhere)
		.orderBy(desc(logs.createdAt), desc(logs.uri))
		.limit(limit + 1)

	const page = rows.slice(0, limit)
	const views: LogView[] = page.map((row) => ({
		uri: row.uri,
		cid: row.cid,
		author: row.author,
		record: row.record,
		likeCount: row.likeCount,
		commentCount: row.commentCount,
		createdAt: row.createdAt.toISOString(),
	}))
	await hydrateViewerLikes(db, viewer, views)

	const last = page.at(-1)
	return {
		feed: views,
		cursor: rows.length > limit && last ? encodeCursor(last.createdAt, last.uri) : null,
	}
}

/** Logs from accounts the viewer follows (viewer's own logs included). */
export async function getTimeline(
	db: Db,
	viewer: string,
	limit: number,
	cursor: string | null,
): Promise<FeedPage> {
	const followedSubquery = db
		.select({ did: follows.subjectDid })
		.from(follows)
		.where(eq(follows.did, viewer))
	const blocked = await blockedDids(db, viewer)
	const where = and(
		or(inArray(logs.did, followedSubquery), eq(logs.did, viewer)),
		blocked.length > 0 ? sql`${logs.did} not in ${blocked}` : undefined,
	)
	return logPage(db, where, viewer, limit, cursor)
}

export async function getAuthorFeed(
	db: Db,
	actor: string,
	viewer: string | null,
	limit: number,
	cursor: string | null,
): Promise<FeedPage> {
	return logPage(db, eq(logs.did, actor), viewer, limit, cursor)
}

export async function getGameActivity(
	db: Db,
	igdbId: number,
	viewer: string | null,
	limit: number,
	cursor: string | null,
): Promise<FeedPage> {
	return logPage(db, eq(logs.igdbId, igdbId), viewer, limit, cursor)
}

export interface CommentView {
	uri: string
	author: ActorView
	text: string
	parentUri: string | null
	createdAt: string
	viewer?: { like: string | null }
}

/** A log plus its visible comments (gate-filtered). */
export async function getLogThread(
	db: Db,
	uri: string,
	viewer: string | null,
): Promise<{ log: LogView; comments: CommentView[]; gate: unknown } | null> {
	const logRows = await db
		.select({
			uri: logs.uri,
			cid: logs.cid,
			record: logs.record,
			likeCount: logs.likeCount,
			commentCount: logs.commentCount,
			createdAt: logs.createdAt,
			author: actorColumns,
		})
		.from(logs)
		.innerJoin(actors, eq(actors.did, logs.did))
		.where(eq(logs.uri, uri))
	const logRow = logRows[0]
	if (!logRow) return null

	const logView: LogView = {
		uri: logRow.uri,
		cid: logRow.cid,
		author: logRow.author,
		record: logRow.record,
		likeCount: logRow.likeCount,
		commentCount: logRow.commentCount,
		createdAt: logRow.createdAt.toISOString(),
	}

	const gateRows = await db.select().from(gates).where(eq(gates.subjectUri, uri))
	const gate = gateRows[0] ?? null
	const hidden = new Set((gate?.hiddenComments as string[] | null) ?? [])

	const blocked = viewer ? new Set(await blockedDids(db, viewer)) : new Set<string>()

	const commentRows = await db
		.select({
			uri: comments.uri,
			text: comments.text,
			parentUri: comments.parentUri,
			createdAt: comments.createdAt,
			author: actorColumns,
		})
		.from(comments)
		.innerJoin(actors, eq(actors.did, comments.did))
		.where(eq(comments.subjectUri, uri))
		.orderBy(comments.createdAt)

	const commentViews: CommentView[] = commentRows
		.filter((row) => !hidden.has(row.uri) && !blocked.has(row.author.did))
		.map((row) => ({
			uri: row.uri,
			author: row.author,
			text: row.text,
			parentUri: row.parentUri,
			createdAt: row.createdAt.toISOString(),
		}))

	await hydrateViewerLikes(db, viewer, logView ? [logView] : [])

	return {
		log: logView,
		comments: commentViews,
		gate: gate ? { allow: gate.allow, disableLikes: gate.disableLikes } : null,
	}
}

export interface ActorProfileView {
	actor: ActorView & { active: boolean; profile: unknown }
	followerCount: number
	followingCount: number
	logCount: number
	viewer?: { following: string | null }
}

export async function getActorProfile(
	db: Db,
	actor: string,
	viewer: string | null,
): Promise<ActorProfileView | null> {
	const rows = await db.select().from(actors).where(eq(actors.did, actor))
	const row = rows[0]
	if (!row) return null

	const [followers, following, logCount] = await Promise.all([
		db.$count(follows, eq(follows.subjectDid, actor)),
		db.$count(follows, eq(follows.did, actor)),
		db.$count(logs, eq(logs.did, actor)),
	])

	let viewerFollow: string | null = null
	if (viewer && viewer !== actor) {
		const followRows = await db
			.select({ uri: follows.uri })
			.from(follows)
			.where(and(eq(follows.did, viewer), eq(follows.subjectDid, actor)))
		viewerFollow = followRows[0]?.uri ?? null
	}

	return {
		actor: {
			did: row.did,
			handle: row.handle,
			displayName: row.displayName,
			avatarCid: row.avatarCid,
			active: row.active,
			profile: row.profile,
		},
		followerCount: followers,
		followingCount: following,
		logCount,
		viewer: viewer ? { following: viewerFollow } : undefined,
	}
}
