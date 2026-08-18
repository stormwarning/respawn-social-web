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

Run HappyView locally with its Docker Compose file (or `cargo run` from source);
SQLite is the default, so no database setup is needed. Use
`PUBLIC_URL=http://127.0.0.1:3000` — **not** `localhost`, which breaks the OAuth
callback — and set `HAPPYVIEW_URL` to the same value. Lexicon and script upload
are the same dashboard steps as above.

The script runs on both backends: it branches on `db.backend()` for placeholder
style (`$1` vs `?`) and JSON access (`record->>'x'` vs `json_extract`).

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
