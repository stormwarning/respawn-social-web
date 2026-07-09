import {
	bigint,
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
} from 'drizzle-orm/pg-core'

const indexedAt = () => timestamp('indexed_at', { withTimezone: true }).notNull().defaultNow()

/** One row per account seen on the firehose; profile record folded in. */
export const actors = pgTable('actors', {
	did: text('did').primaryKey(),
	handle: text('handle'),
	active: boolean('active').notNull().default(true),
	displayName: text('display_name'),
	avatarCid: text('avatar_cid'),
	profile: jsonb('profile'),
	indexedAt: indexedAt(),
})

/** social.respawn.game — collection entry, keyed by did + IGDB id (the rkey). */
export const gameEntries = pgTable(
	'game_entries',
	{
		did: text('did').notNull(),
		igdbId: integer('igdb_id').notNull(),
		rating: integer('rating'),
		liked: boolean('liked'),
		playing: boolean('playing'),
		played: text('played'),
		record: jsonb('record').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
		indexedAt: indexedAt(),
	},
	(t) => [primaryKey({ columns: [t.did, t.igdbId] })],
)

/** social.respawn.feed.log */
export const logs = pgTable(
	'logs',
	{
		uri: text('uri').primaryKey(),
		cid: text('cid').notNull(),
		did: text('did').notNull(),
		rkey: text('rkey').notNull(),
		igdbId: integer('igdb_id').notNull(),
		slug: text('slug').notNull(),
		title: text('title').notNull(),
		rating: integer('rating'),
		liked: boolean('liked'),
		finishedPlaying: text('finished_playing'),
		hasReview: boolean('has_review').notNull().default(false),
		record: jsonb('record').notNull(),
		likeCount: integer('like_count').notNull().default(0),
		commentCount: integer('comment_count').notNull().default(0),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
		indexedAt: indexedAt(),
	},
	(t) => [
		index('logs_did_created_at_idx').on(t.did, t.createdAt),
		index('logs_igdb_created_at_idx').on(t.igdbId, t.createdAt),
	],
)

/** social.respawn.feed.like */
export const likes = pgTable(
	'likes',
	{
		uri: text('uri').primaryKey(),
		did: text('did').notNull(),
		subjectUri: text('subject_uri').notNull(),
		subjectCid: text('subject_cid'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
		indexedAt: indexedAt(),
	},
	(t) => [
		index('likes_subject_uri_idx').on(t.subjectUri),
		uniqueIndex('likes_did_subject_idx').on(t.did, t.subjectUri),
	],
)

/** social.respawn.feed.comment */
export const comments = pgTable(
	'comments',
	{
		uri: text('uri').primaryKey(),
		did: text('did').notNull(),
		subjectUri: text('subject_uri').notNull(),
		parentUri: text('parent_uri'),
		text: text('text').notNull(),
		record: jsonb('record').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
		indexedAt: indexedAt(),
	},
	(t) => [index('comments_subject_uri_idx').on(t.subjectUri)],
)

/** social.respawn.feed.gate — rkey matches the gated log/list record. */
export const gates = pgTable(
	'gates',
	{
		uri: text('uri').primaryKey(),
		did: text('did').notNull(),
		rkey: text('rkey').notNull(),
		subjectUri: text('subject_uri').notNull(),
		/** Allow-rule fragment names, e.g. ['nobodyRule']; null = everyone. */
		allow: jsonb('allow'),
		disableLikes: boolean('disable_likes').notNull().default(false),
		hiddenComments: jsonb('hidden_comments'),
		record: jsonb('record').notNull(),
		indexedAt: indexedAt(),
	},
	(t) => [uniqueIndex('gates_subject_uri_idx').on(t.subjectUri)],
)

/** social.respawn.graph.follow */
export const follows = pgTable(
	'follows',
	{
		uri: text('uri').primaryKey(),
		did: text('did').notNull(),
		subjectDid: text('subject_did').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
		indexedAt: indexedAt(),
	},
	(t) => [index('follows_did_idx').on(t.did), index('follows_subject_did_idx').on(t.subjectDid)],
)

/** social.respawn.graph.block */
export const blocks = pgTable(
	'blocks',
	{
		uri: text('uri').primaryKey(),
		did: text('did').notNull(),
		subjectDid: text('subject_did').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
		indexedAt: indexedAt(),
	},
	(t) => [index('blocks_did_idx').on(t.did), index('blocks_subject_did_idx').on(t.subjectDid)],
)

/** social.respawn.list */
export const lists = pgTable(
	'lists',
	{
		uri: text('uri').primaryKey(),
		did: text('did').notNull(),
		rkey: text('rkey').notNull(),
		name: text('name').notNull(),
		slug: text('slug').notNull(),
		ranked: boolean('ranked').notNull().default(false),
		itemCount: integer('item_count').notNull().default(0),
		record: jsonb('record').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
		indexedAt: indexedAt(),
	},
	(t) => [index('lists_did_slug_idx').on(t.did, t.slug)],
)

/** social.respawn.actor.backlog — singleton per repo. */
export const backlogs = pgTable('backlogs', {
	did: text('did').primaryKey(),
	gameCount: integer('game_count').notNull().default(0),
	record: jsonb('record').notNull(),
	indexedAt: indexedAt(),
})

/** Jetstream cursor persistence (single row, id 'jetstream'). */
export const ingestState = pgTable('ingest_state', {
	id: text('id').primaryKey(),
	/** Last processed time_us. */
	cursor: bigint('cursor', { mode: 'number' }).notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
