# Appview (HappyView)

The appview is [HappyView](https://happyview.dev) — a lexicon-driven AppView run
as a prebuilt service, not code in this repo. It indexes `social.respawn.*`
records off Jetstream (plus backfill from PDSs) and serves the XRPC read
endpoints the SvelteKit server calls.

This directory holds only what we configure it with:

| File              | Purpose                                                |
| ----------------- | ------------------------------------------------------ |
| `getTimeline.lua` | Query script backing `social.respawn.feed.getTimeline` |

Lexicons live in `packages/lexicons/lexicons/`; the ones HappyView needs are
listed below.

## What's indexed

Only the collections behind the following feed:

- `social.respawn.backlog.item` — "added a game to their backlog"
- `social.respawn.graph.follow` — "followed someone"

Plays, ratings, and likes are deliberately not indexed yet. Add those lexicons
when game pages need cross-user counts.

## Deploy (Railway)

1. Deploy the HappyView template on Railway and attach a Postgres database.
2. Set the service env:

   | Var                    | Value                                               |
   | ---------------------- | --------------------------------------------------- |
   | `DATABASE_URL`         | Railway Postgres connection string                  |
   | `PUBLIC_URL`           | The service's public URL (used for OAuth callbacks) |
   | `SESSION_SECRET`       | `openssl rand -hex 64`                              |
   | `TOKEN_ENCRYPTION_KEY` | `openssl rand -base64 32`                           |
   | `JETSTREAM_URL`        | optional; defaults to Bluesky's jetstream1.us-east  |
   | `RELAY_URL`            | optional; defaults to bsky.network                  |

3. Open the deployed URL and log in with your atproto account. **The first
   account to log in becomes super user**, so do this before sharing the URL.

## Configure

1. **Record lexicons** — Lexicons → Add Lexicon, then upload
   `social.respawn.backlog.item` and `social.respawn.graph.follow`. Both
   reference `social.respawn.defs`, so upload that too. Adding a record lexicon
   kicks off a backfill job; watch the per-collection counts on the dashboard.
2. **Query lexicon** — upload `social.respawn.feed.getTimeline`, then attach
   `getTimeline.lua` to it as `xrpc.query:social.respawn.feed.getTimeline`. The
   default query behaviour (list by DID/URI) can't do the follow-set join, so
   the script is required, not optional.
3. **API key** — create one scoped to queries. It's shown once.

## Point the web app at it

Set in `apps/web/.env` (and in the Netlify site env for production):

```sh
HAPPYVIEW_URL=https://your-happyview.up.railway.app
HAPPYVIEW_API_KEY=hv_…
```

Unset `HAPPYVIEW_URL` falls back to PDS-direct reads, which means no following
feed — the home page says so rather than erroring.

Smoke test:

```sh
curl -H "Authorization: Bearer $HAPPYVIEW_API_KEY" \
  "$HAPPYVIEW_URL/xrpc/social.respawn.feed.getTimeline?viewer=did:plc:…&limit=5"
```

## Local development

Run HappyView from a clone of its repo with `docker compose up`. SQLite is the
default, so there's no database to set up. Lexicon and script upload are the same
dashboard steps as above.

**Browse the Caddy port, `http://127.0.0.1:3080`.** The dev stack runs three
services and only Caddy is a complete front door: it serves the dashboard and
proxies `/xrpc`, `/admin`, `/auth`, and `/config` to the Rust service. The other
published ports are half the app — `:3001` is the Next dev server with no API
behind it, `:3000` is the API with no dashboard.

Use `127.0.0.1`, not `localhost`, which breaks the OAuth callback. Set
`HAPPYVIEW_URL` in `apps/web/.env` to the same origin you browse.

### If you get `Failed to load config: Config fetch failed: 421`

HappyView resolves every request against a table of known domains (seeded from
`PUBLIC_URL` on first boot, re-synced to it on later boots) and answers `421
Misdirected Request` for any host it doesn't recognise. A 421 means the host in
your address bar isn't the one HappyView knows about.

The usual cause is the Cloudflare tunnel: `scripts/entrypoint.sh` overwrites
`PUBLIC_URL` with the tunnel URL whenever `TUNNEL_URL_FILE` is set, which the
compose file always sets. So the registered domain becomes
`*.trycloudflare.com`, and `127.0.0.1` gets rejected however you reach it.
Either browse the tunnel URL, or go local-only: stop the tunnel container,
delete the shared `tunnel-url` file so the entrypoint falls back to your `.env`,
set `PUBLIC_URL=http://127.0.0.1:3080`, and restart. No manual database edit is
needed — HappyView re-points the primary domain row at `PUBLIC_URL` on boot.

### Ports

HappyView's compose publishes `3000` (API), `3001` (dashboard dev server), and
`3080` (Caddy). The IGDB API in `respawn-social-api` defaults to `8000` to stay
clear of them; if you change either, check for a collision first — two services
on one port fail confusingly, with requests silently hitting the wrong one.

### The feed script

`getTimeline.lua` runs on both database backends: it branches on `db.backend()`
for placeholder style (`$1` vs `?`) and JSON access (`record->>'x'` vs
`json_extract`).

Keep every `db`, `json`, and `toarray` call inside `handle()`. HappyView
validates an uploaded script by executing the chunk in a sandbox where only
`env` is defined, so touching any other injected global at the top level fails
the upload with `attempt to index a nil value (global 'db')` — the script itself
is fine, it just ran too early.

## How the feed query works

`db.query` can't filter by a set of DIDs, and it orders by index time rather
than the record's own `createdAt` — which would put backfilled history at the
top. So `getTimeline.lua` uses `db.raw`:

1. Read the viewer's follows (capped at 500) and collect the subject DIDs.
2. One query over both collections filtered to those DIDs, ordered by the
   record's `createdAt` descending, `uri` breaking ties.
3. Fetch `limit + 1` rows; if the extra row exists, return a cursor of
   `<createdAt>::<uri>` and resume with a keyset comparison on the next call.

Adding a new event type to the feed means adding its collection to the
`collection IN (…)` list and mapping its record fields to a `#feedItem`.
