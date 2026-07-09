import { serve } from '@hono/node-server'
import { buildApp } from './api/app.ts'
import { db } from './db/client.ts'
import { env } from './env.ts'
import { runIngester } from './ingester/jetstream.ts'

const app = buildApp(db, env.appviewSecret)

serve({ fetch: app.fetch, port: env.port }, (info) => {
	console.log(`[api] listening on :${info.port}`)
})

if (env.ingest) {
	runIngester(db, env.jetstreamUrl).catch((err) => {
		console.error('[ingester] fatal', err)
		process.exit(1)
	})
}
