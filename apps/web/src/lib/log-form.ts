import { PLAYED_OPTIONS, type PlayedState } from '$lib/atproto/game'
import {
	hasReview,
	type ReplyRule,
	type ReplygateSettings,
	type RespawnLogRecord,
} from '$lib/atproto/log'
import type { RichTextValue } from '$lib/richtext/types'

/** The game a log is about, as the dialog shows it. */
export interface LogGame {
	igdbId: number
	slug: string
	title: string
	year?: number | null
	coverUrl?: string | null
}

/** The viewer's current state for the game, used to pick the dialog's defaults. */
export interface CurrentPlayState {
	playing: boolean
	played: PlayedState | null
}

/**
 * Who can comment: anyone, no one, or the union of one or more rules. The rule
 * list is never empty; unticking the last one goes back to anyone.
 */
export type ReplyAllow = 'anyone' | 'nobody' | ReplyRule[]

/** The combinable comment rules, in menu order. */
export const REPLY_RULE_OPTIONS: Array<{ value: ReplyRule; label: string }> = [
	{ value: 'followers', label: 'Your followers' },
	{ value: 'following', label: 'People you follow' },
	{ value: 'mention', label: 'People you mention' },
]

/** Ways a session can leave a playthrough: still going, or one of the played states. */
export const LOG_OUTCOMES: Array<{ value: PlayedState | null; label: string; hint: string }> = [
	{ value: null, label: 'Still playing', hint: 'Or no change' },
	...PLAYED_OPTIONS,
]

/** Flat form state for the log dialog. Empty strings, `false` and 0 mean "not set". */
export interface LogFormValue {
	/** `yyyy-mm-dd`, as a date input gives it. */
	datePlayed: string
	platform: string
	edition: string
	dlc: string[]
	/** This session began a playthrough. */
	startedPlaying: boolean
	/** This session ended the playthrough with this outcome; null means still playing. */
	finishedPlaying: PlayedState | null
	/** 0–10 in half-star steps; 0 means unrated. */
	rating: number
	liked: boolean
	review: RichTextValue
	containsSpoilers: boolean
	allow: ReplyAllow
}

export interface LogResult {
	log: RespawnLogRecord
	/** Only present when comments are limited. */
	replygate?: ReplygateSettings
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Today in the viewer's time zone, as `yyyy-mm-dd`. */
export function today(now = new Date()): string {
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * A blank log. Only a game with no state at all defaults to "started playing":
 * someone already playing is continuing, and someone who has finished it has to
 * opt in to a replay.
 */
export function emptyLogForm(current?: CurrentPlayState, date = today()): LogFormValue {
	return {
		datePlayed: date,
		platform: '',
		edition: '',
		dlc: [],
		startedPlaying: !current || (!current.playing && current.played === null),
		finishedPlaying: null,
		rating: 0,
		liked: false,
		review: { text: '' },
		containsSpoilers: false,
		allow: 'anyone',
	}
}

/** Build the log record and replygate settings, dropping anything left unset. */
export function toLogRecord(
	value: LogFormValue,
	game: LogGame,
	createdAt = new Date().toISOString(),
): LogResult {
	const platform = value.platform.trim()
	const edition = value.edition.trim()
	const dlc = value.dlc.map((item) => item.trim()).filter(Boolean)
	const hasText = value.review.text.trim() !== ''

	const log: RespawnLogRecord = {
		game: { igdbId: game.igdbId, slug: game.slug, title: game.title },
		edition: edition || undefined,
		dlc: dlc.length ? dlc : undefined,
		platform: platform || undefined,
		datePlayed: value.datePlayed
			? new Date(`${value.datePlayed}T00:00:00Z`).toISOString()
			: undefined,
		startedPlaying: value.startedPlaying || undefined,
		finishedPlaying: value.finishedPlaying ?? undefined,
		rating: value.rating || undefined,
		liked: value.liked || undefined,
		review: hasText
			? stripUndefined({
					text: value.review.text,
					textWithSpoilers: value.review.textWithSpoilers,
					facets: value.review.facets?.length ? value.review.facets : undefined,
					containsSpoilers: value.containsSpoilers || undefined,
				})
			: undefined,
		createdAt,
	}

	return {
		log: stripUndefined(log),
		replygate: toReplygate(value.allow),
	}
}

/** Form state for editing an existing log. */
export function fromLogRecord(log: RespawnLogRecord, replygate?: ReplygateSettings): LogFormValue {
	const review = log.review
	return {
		datePlayed: log.datePlayed?.slice(0, 10) ?? '',
		platform: log.platform ?? '',
		edition: log.edition ?? '',
		dlc: log.dlc ?? [],
		startedPlaying: log.startedPlaying ?? false,
		finishedPlaying: log.finishedPlaying ?? null,
		rating: log.rating ?? 0,
		liked: log.liked ?? false,
		review: review
			? stripUndefined({
					text: review.text,
					textWithSpoilers: review.textWithSpoilers,
					facets: review.facets,
				})
			: { text: '' },
		containsSpoilers: review?.containsSpoilers ?? false,
		allow: fromReplygate(replygate),
	}
}

function toReplygate(allow: ReplyAllow): ReplygateSettings | undefined {
	if (allow === 'anyone') return undefined
	return { allow: allow === 'nobody' ? [] : allow }
}

function fromReplygate(replygate?: ReplygateSettings): ReplyAllow {
	const allow = replygate?.allow
	if (!allow) return 'anyone'
	return allow.length ? allow : 'nobody'
}

const FINISHED_VERBS: Record<PlayedState, string> = {
	played: 'finished playing',
	completed: 'completed',
	retired: 'retired',
	shelved: 'shelved',
	abandoned: 'abandoned',
}

type ActivityFields = Pick<
	RespawnLogRecord,
	'startedPlaying' | 'finishedPlaying' | 'rating' | 'review'
>

/**
 * What a log did, as the verb of its activity-feed line. Read from the log
 * alone: the fields describe the session, so no earlier state is needed.
 */
export function activityVerb(log: ActivityFields): string {
	if (log.startedPlaying && log.finishedPlaying) {
		return log.finishedPlaying === 'played'
			? 'played through'
			: `started and ${FINISHED_VERBS[log.finishedPlaying]}`
	}
	if (log.startedPlaying) return 'started playing'
	if (log.finishedPlaying) return FINISHED_VERBS[log.finishedPlaying]
	if (hasReview(log)) return 'reviewed'
	if (log.rating) return 'rated'
	return 'logged'
}

export function activitySentence(
	log: ActivityFields & Pick<RespawnLogRecord, 'game'>,
	actor: string,
): string {
	return `${actor} ${activityVerb(log)} ${log.game.title}`
}

/** Drop `undefined` keys, so the object is exactly what gets written. */
function stripUndefined<T extends object>(value: T): T {
	return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T
}
