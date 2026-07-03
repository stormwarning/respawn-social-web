/**
 * Collection NSIDs for all social.respawn.* record types.
 */
export const Collections = {
	game: 'social.respawn.game',
	list: 'social.respawn.list',
	log: 'social.respawn.feed.log',
	like: 'social.respawn.feed.like',
	comment: 'social.respawn.feed.comment',
	gate: 'social.respawn.feed.gate',
	follow: 'social.respawn.graph.follow',
	block: 'social.respawn.graph.block',
	profile: 'social.respawn.actor.profile',
	backlog: 'social.respawn.actor.backlog',
} as const

export type CollectionNsid = (typeof Collections)[keyof typeof Collections]

/** All record collections, e.g. for a Jetstream `wantedCollections` filter. */
export const ALL_COLLECTIONS: readonly CollectionNsid[] = Object.values(Collections)
