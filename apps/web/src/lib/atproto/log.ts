import type { Agent } from '@atproto/api'
import { Collections } from '@respawn-social/lexicons'
import type { CoverRef, GameRef, PlayedState, RespawnGameRecord } from '$lib/atproto/game'
import { listAllRecords, type RecordEnvelope } from '$lib/atproto/records'
import { generateTid } from '$lib/atproto/tid'
import type { Facet } from '$lib/richtext/types'

export const RESPAWN_LOG_COLLECTION = Collections.log
export const RESPAWN_REPLYGATE_COLLECTION = Collections.replygate

export type { GameRef }

export interface LogReview {
	/** Display text; spoiler spans are scrambled here. */
	text: string
	/** Original text with spoiler spans unscrambled. */
	textWithSpoilers?: string
	/** Whole-review spoiler flag. */
	containsSpoilers?: boolean
	facets?: Facet[]
	/** An external document (e.g. standard.site) holding the full review. */
	external?: { uri: string; cid?: string }
}

/**
 * A play-session log, stored at `social.respawn.feed.log/<tid>`. Mirrors the
 * lexicon in `packages/lexicons/lexicons/social/respawn/feed/log.json`.
 * Hand-declared so `cover.image` lines up with the @atproto/api `BlobRef`.
 */
export interface RespawnLogRecord {
	$type?: typeof RESPAWN_LOG_COLLECTION
	game: GameRef
	edition?: string
	dlc?: string[]
	platform?: string
	cover?: CoverRef
	datePlayed?: string
	startedPlaying?: boolean
	finishedPlaying?: PlayedState
	rating?: number
	liked?: boolean
	review?: LogReview
	createdAt: string
}

/** A group of actors who may comment when comments are limited. */
export type ReplyRule = 'followers' | 'following' | 'mention'

export interface ReplygateSettings {
	/** The union of these rules may comment. Absent means anyone; `[]` means no one. */
	allow?: ReplyRule[]
}

/**
 * Replygate record controlling who can comment on a log or list, stored at
 * `social.respawn.feed.replygate/<rkey of the gated record>`.
 */
export interface RespawnReplygateRecord {
	$type?: typeof RESPAWN_REPLYGATE_COLLECTION
	subject: string
	allow?: Array<{ $type: string }>
	hiddenComments?: string[]
	createdAt: string
}

const REPLY_RULE_TYPES: Record<ReplyRule, string> = {
	followers: `${Collections.replygate}#followerRule`,
	following: `${Collections.replygate}#followingRule`,
	mention: `${Collections.replygate}#mentionRule`,
}

export interface CreateLogOptions {
	/** Who can comment; only written when provided (absent = anyone). */
	replygate?: ReplygateSettings
	/**
	 * Denormalized current-state update of the `social.respawn.game` record,
	 * written atomically with the log. `exists` picks update vs create.
	 */
	game?: { igdbId: number; record: RespawnGameRecord; exists: boolean }
}

/**
 * Create a log record — plus its replygate record and the game record's
 * current-state update — in a single `applyWrites` batch.
 */
export async function createLog(
	agent: Agent,
	did: string,
	log: RespawnLogRecord,
	options: CreateLogOptions = {},
): Promise<{ uri: string; rkey: string }> {
	const rkey = generateTid()
	const writes: object[] = [
		{
			$type: 'com.atproto.repo.applyWrites#create',
			collection: RESPAWN_LOG_COLLECTION,
			rkey,
			value: { $type: RESPAWN_LOG_COLLECTION, ...log },
		},
	]

	if (options.replygate) {
		const replygate: RespawnReplygateRecord = {
			subject: `at://${did}/${RESPAWN_LOG_COLLECTION}/${rkey}`,
			allow: options.replygate.allow?.map((rule) => ({ $type: REPLY_RULE_TYPES[rule] })),
			createdAt: log.createdAt,
		}
		writes.push({
			$type: 'com.atproto.repo.applyWrites#create',
			collection: RESPAWN_REPLYGATE_COLLECTION,
			rkey,
			value: { $type: RESPAWN_REPLYGATE_COLLECTION, ...replygate },
		})
	}

	if (options.game) {
		writes.push({
			$type: options.game.exists
				? 'com.atproto.repo.applyWrites#update'
				: 'com.atproto.repo.applyWrites#create',
			collection: Collections.game,
			rkey: String(options.game.igdbId),
			value: { $type: Collections.game, ...options.game.record },
		})
	}

	await agent.com.atproto.repo.applyWrites({ repo: did, writes: writes as never })
	return { uri: `at://${did}/${RESPAWN_LOG_COLLECTION}/${rkey}`, rkey }
}

/** Delete a log and its replygate record (if any) in one batch. */
export async function deleteLog(agent: Agent, did: string, rkey: string): Promise<void> {
	await agent.com.atproto.repo.applyWrites({
		repo: did,
		writes: [
			{ $type: 'com.atproto.repo.applyWrites#delete', collection: RESPAWN_LOG_COLLECTION, rkey },
			{
				$type: 'com.atproto.repo.applyWrites#delete',
				collection: RESPAWN_REPLYGATE_COLLECTION,
				rkey,
			},
		] as never,
	})
}

/**
 * List log records from a repo (own or public), newest first, optionally
 * filtered to one game. Uses `listRecords` pagination — fine at repo scale;
 * cross-user aggregation waits for HappyView to index logs.
 */
/**
 * Whether a log carries a review: text, or a link out to one. Only a log with a
 * review can be liked or commented on.
 */
export function hasReview(log: Pick<RespawnLogRecord, 'review'>): boolean {
	return Boolean(log.review?.text.trim() || log.review?.external)
}

/**
 * When a log's session happened, for ordering a profile's logs: the day played
 * when given, else when it was logged. Log numbers and the activity feed go by
 * `createdAt` instead, so backdating a log never renumbers its page.
 */
export function playedAt(log: RespawnLogRecord): string {
	return log.datePlayed ?? log.createdAt
}

/**
 * A user's logs, optionally for one game.
 *
 * `igdbIds` rather than a single id, because a title is made of several IGDB
 * ids: someone who logged a DLC in 2023 and the base game in 2025 has both
 * under one title now, and filtering on a single id would split their history
 * in two and restart the numbering. Callers pass `title.members`.
 *
 * Logs are never rewritten or moved. They are history, and the fold is resolved
 * at read time — see §7.4 of docs/PLAN-igdb-mirror.md in the API repo.
 */
export async function listLogs(
	agent: Agent,
	did: string,
	{ igdbId, igdbIds, slug }: { igdbId?: number; igdbIds?: number[]; slug?: string } = {},
): Promise<RecordEnvelope<RespawnLogRecord>[]> {
	const all = await listAllRecords<RespawnLogRecord>(agent, did, RESPAWN_LOG_COLLECTION)
	const wanted = igdbIds ? new Set(igdbIds) : igdbId != null ? new Set([igdbId]) : null

	return all
		.filter((log) => {
			const id = log.value.game?.igdbId
			if (wanted !== null && (id == null || !wanted.has(id))) return false
			if (slug != null && log.value.game?.slug !== slug) return false
			return true
		})
		.toSorted((a, b) => (a.value.createdAt < b.value.createdAt ? 1 : -1))
}
