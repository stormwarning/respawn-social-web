import { Hono } from 'hono'
import type { Db } from '../db/client.ts'
import {
	getActorProfile,
	getAuthorFeed,
	getGameActivity,
	getLogThread,
	getTimeline,
} from './views.ts'

const MAX_LIMIT = 100

function parseLimit(value: string | undefined): number {
	const n = Number(value ?? 50)
	if (!Number.isInteger(n) || n < 1) return 50
	return Math.min(n, MAX_LIMIT)
}

/**
 * XRPC-style read API.  Server-to-server only: the SvelteKit app verified the
 * OAuth session and passes the viewer DID as a query param, authenticated by
 * the shared secret header.
 */
export function buildApp(db: Db, secret: string | undefined): Hono {
	const app = new Hono()

	app.get('/health', (c) => c.json({ ok: true }))

	app.use('/xrpc/*', async (c, next) => {
		if (secret && c.req.header('x-appview-secret') !== secret) {
			return c.json({ error: 'Unauthorized' }, 401)
		}
		await next()
	})

	app.get('/xrpc/social.respawn.feed.getTimeline', async (c) => {
		const viewer = c.req.query('viewer')
		if (!viewer) return c.json({ error: 'viewer is required' }, 400)
		const page = await getTimeline(
			db,
			viewer,
			parseLimit(c.req.query('limit')),
			c.req.query('cursor') ?? null,
		)
		return c.json(page)
	})

	app.get('/xrpc/social.respawn.feed.getAuthorFeed', async (c) => {
		const actor = c.req.query('actor')
		if (!actor) return c.json({ error: 'actor is required' }, 400)
		const page = await getAuthorFeed(
			db,
			actor,
			c.req.query('viewer') ?? null,
			parseLimit(c.req.query('limit')),
			c.req.query('cursor') ?? null,
		)
		return c.json(page)
	})

	app.get('/xrpc/social.respawn.feed.getGameActivity', async (c) => {
		const igdbId = Number(c.req.query('igdbId'))
		if (!Number.isInteger(igdbId) || igdbId < 1) {
			return c.json({ error: 'igdbId is required' }, 400)
		}
		const page = await getGameActivity(
			db,
			igdbId,
			c.req.query('viewer') ?? null,
			parseLimit(c.req.query('limit')),
			c.req.query('cursor') ?? null,
		)
		return c.json(page)
	})

	app.get('/xrpc/social.respawn.feed.getLogThread', async (c) => {
		const uri = c.req.query('uri')
		if (!uri) return c.json({ error: 'uri is required' }, 400)
		const thread = await getLogThread(db, uri, c.req.query('viewer') ?? null)
		if (!thread) return c.json({ error: 'Log not found' }, 404)
		return c.json(thread)
	})

	app.get('/xrpc/social.respawn.actor.getProfile', async (c) => {
		const actor = c.req.query('actor')
		if (!actor) return c.json({ error: 'actor is required' }, 400)
		const profile = await getActorProfile(db, actor, c.req.query('viewer') ?? null)
		if (!profile) return c.json({ error: 'Actor not found' }, 404)
		return c.json(profile)
	})

	app.onError((err, c) => {
		console.error('[api]', err)
		return c.json({ error: 'Internal error' }, 500)
	})

	return app
}
