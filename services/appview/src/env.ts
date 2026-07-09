/** Environment configuration.  Only DATABASE_URL is required. */
export const env = {
	/** Postgres connection string. */
	databaseUrl: required('DATABASE_URL'),
	/** HTTP port for the read API. */
	port: Number(process.env.PORT ?? 8100),
	/** Shared secret required in the `x-appview-secret` header. Unset = open (dev). */
	appviewSecret: process.env.APPVIEW_SECRET,
	/** Jetstream endpoint. */
	jetstreamUrl: process.env.JETSTREAM_URL ?? 'wss://jetstream2.us-west.bsky.network/subscribe',
	/** Relay used by the sync backfill to enumerate repos per collection. */
	relayUrl: process.env.RELAY_URL ?? 'https://relay1.us-west.bsky.network',
	/** Set to '0' to run the HTTP API without the Jetstream consumer. */
	ingest: process.env.INGEST !== '0',
}

function required(name: string): string {
	const value = process.env[name]
	if (!value) throw new Error(`Missing required env var ${name}`)
	return value
}
