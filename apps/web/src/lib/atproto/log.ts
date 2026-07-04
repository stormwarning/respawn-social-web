import type { Agent } from '@atproto/api'
import { Collections } from '@respawn-social/lexicons'
import type { CoverRef, PlayedState, RespawnGameRecord } from '$lib/atproto/game'
import { listAllRecords, type RecordEnvelope } from '$lib/atproto/records'
import { generateTid } from '$lib/atproto/tid'

export const RESPAWN_LOG_COLLECTION = Collections.log
export const RESPAWN_GATE_COLLECTION = Collections.gate

/** Denormalized game reference stored on every log (see social.respawn.defs#gameRef). */
export interface GameRef {
	igdbId: number
	slug: string
	title: string
}

export interface LogReview {
	/** Display text; spoiler spans are scrambled here. */
	text: string
	/** Original text with spoiler spans unscrambled. */
	textWithSpoilers?: string
	/** Whole-review spoiler flag. */
	containsSpoilers?: boolean
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

export type GateAllowRule = 'nobody' | 'following' | 'followers'

export interface GateSettings {
	/** Absent means everyone may comment; `['nobody']` or `[]` means no one. */
	allow?: GateAllowRule[]
	disableLikes?: boolean
}

/**
 * Gate record controlling interactions on a log or list, stored at
 * `social.respawn.feed.gate/<rkey of the gated record>`.
 */
export interface RespawnGateRecord {
	$type?: typeof RESPAWN_GATE_COLLECTION
	subject: string
	allow?: Array<{ $type: string }>
	disableLikes?: boolean
	hiddenComments?: string[]
	createdAt: string
}

const GATE_RULE_TYPES: Record<GateAllowRule, string> = {
	nobody: `${Collections.gate}#nobodyRule`,
	following: `${Collections.gate}#followingRule`,
	followers: `${Collections.gate}#followerRule`,
}

export interface CreateLogOptions {
	/** Interaction settings; only written when provided (absent = everyone). */
	gate?: GateSettings
	/**
	 * Denormalized current-state update of the `social.respawn.game` record,
	 * written atomically with the log. `exists` picks update vs create.
	 */
	game?: { igdbId: number; record: RespawnGameRecord; exists: boolean }
}

/**
 * Create a log record — plus its gate record and the game record's
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

	if (options.gate) {
		const gate: RespawnGateRecord = {
			subject: `at://${did}/${RESPAWN_LOG_COLLECTION}/${rkey}`,
			allow: options.gate.allow?.map((rule) => ({ $type: GATE_RULE_TYPES[rule] })),
			disableLikes: options.gate.disableLikes || undefined,
			createdAt: log.createdAt,
		}
		writes.push({
			$type: 'com.atproto.repo.applyWrites#create',
			collection: RESPAWN_GATE_COLLECTION,
			rkey,
			value: { $type: RESPAWN_GATE_COLLECTION, ...gate },
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

/** Delete a log and its gate record (if any) in one batch. */
export async function deleteLog(agent: Agent, did: string, rkey: string): Promise<void> {
	await agent.com.atproto.repo.applyWrites({
		repo: did,
		writes: [
			{ $type: 'com.atproto.repo.applyWrites#delete', collection: RESPAWN_LOG_COLLECTION, rkey },
			{ $type: 'com.atproto.repo.applyWrites#delete', collection: RESPAWN_GATE_COLLECTION, rkey },
		] as never,
	})
}

/**
 * List log records from a repo (own or public), newest first, optionally
 * filtered to one game. Uses `listRecords` pagination — fine at repo scale;
 * cross-user aggregation waits for the appview.
 */
export async function listLogs(
	agent: Agent,
	did: string,
	{ igdbId, slug }: { igdbId?: number; slug?: string } = {},
): Promise<RecordEnvelope<RespawnLogRecord>[]> {
	const all = await listAllRecords<RespawnLogRecord>(agent, did, RESPAWN_LOG_COLLECTION)
	return all
		.filter((log) => {
			if (igdbId != null && log.value.game?.igdbId !== igdbId) return false
			if (slug != null && log.value.game?.slug !== slug) return false
			return true
		})
		.toSorted((a, b) => (a.value.createdAt < b.value.createdAt ? 1 : -1))
}
