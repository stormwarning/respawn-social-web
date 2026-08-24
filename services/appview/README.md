# Appview (HappyView)

The appview is [HappyView](https://happyview.dev) — a lexicon-driven AppView run
as a prebuilt service, not code in this repo. It indexes `social.respawn.*`
records off Jetstream (plus backfill from PDSs) and serves the XRPC read
endpoints the SvelteKit server calls.

This directory holds only what we configure it with:

| File              | Purpose                                                |
| ----------------- | ------------------------------------------------------ |
| `getActivity.lua` | Query script backing `social.respawn.feed.getActivity` |

Lexicons live in `packages/lexicons/lexicons/`; the ones HappyView needs are
listed below.

## What's indexed

Only the collections behind the activity feeds:

- `social.respawn.backlog.item` — "added a game to their backlog"
- `social.respawn.graph.follow` — "followed someone"

Plays, ratings, and likes are deliberately not indexed yet. Add those lexicons
when game pages need cross-user counts. Until likes and comments are indexed,
the `incoming` filter can only ever mean "someone followed you" — follow is the
one indexed collection whose records name another account as their subject.

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
2. **Query lexicon** — upload `social.respawn.feed.getActivity`, then attach
   `getActivity.lua` to it as `xrpc.query:social.respawn.feed.getActivity`. The
   script isn't optional: without one, HappyView falls back to its default list
   query, which needs a `target_collection` this lexicon doesn't have, and every
   request fails with `has no target_collection configured for list queries`.

If you are upgrading an appview that still serves `social.respawn.feed.getTimeline`,
delete that lexicon after `getActivity` is up: nothing calls it any more.

No API key is involved. HappyView's API keys authenticate the **admin API**
only; its XRPC routes reject `Authorization: Bearer hv_…` with a 401 and serve
public records anonymously. The feed takes the actor it is about as a query parameter, so
anonymous is what we want — but note that anyone who can reach the appview can
read any DID's feed, which is why it holds public records only.

## Point the web app at it

Set in `apps/web/.env` (and in the Netlify site env for production):

```sh
HAPPYVIEW_URL=https://your-happyview.up.railway.app
```

Unset `HAPPYVIEW_URL` falls back to PDS-direct reads, which means no activity
feeds — the activity pages say so rather than erroring.

Smoke test (no auth header, deliberately):

```sh
curl "$HAPPYVIEW_URL/xrpc/social.respawn.feed.getActivity?actor=did:plc:…&filter=all&limit=5"
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

This bites the SvelteKit server too, not just the browser: `HAPPYVIEW_URL` has
to be a host HappyView knows itself by, so pointing it at `127.0.0.1` while the
tunnel owns the domain row fails with a 421 even though the dashboard loads fine
in your browser.

Two ways out. Quickest is to set `HAPPYVIEW_URL` to the tunnel URL — but the
quick-tunnel hostname is regenerated every time the tunnel restarts, so it goes
stale. Durable is to go local-only: stop the tunnel container, delete the shared
`tunnel-url` file so the entrypoint falls back to your `.env`, set
`PUBLIC_URL=http://127.0.0.1:3080`, and restart. No manual database edit is
needed — HappyView re-points the primary domain row at `PUBLIC_URL` on boot.

Adding `127.0.0.1` as a _second_ domain through the dashboard doesn't work while
the tunnel is up: `POST /admin/domains` rejects a non-https URL unless the
running `PUBLIC_URL` is itself loopback, which it isn't when the tunnel has
replaced it.

### Ports

HappyView's compose publishes `3000` (API), `3001` (dashboard dev server), and
`3080` (Caddy). The IGDB API in `respawn-social-api` defaults to `8000` to stay
clear of them; if you change either, check for a collision first — two services
on one port fail confusingly, with requests silently hitting the wrong one.

### The feed script

`getActivity.lua` runs on both database backends: it branches on `db.backend()`
for placeholder style (`$1` vs `?`) and JSON access (`record::jsonb->>'x'` vs
`json_extract`).

The `::jsonb` cast is not optional on Postgres. HappyView's migration
`20260318000000_uuid_to_text` converted `records.record` from `JSONB` to `TEXT`,
and `->>` has no operator on `text` — without the cast every query dies with
`operator does not exist: text ->> unknown`. SQLite hides this, so a script that
works locally can still fail on a Postgres deployment.

Keep every `db`, `json`, and `toarray` call inside `handle()`. HappyView
validates an uploaded script by executing the chunk in a sandbox where only
`env` is defined, so touching any other injected global at the top level fails
the upload with `attempt to index a nil value (global 'db')` — the script itself
is fine, it just ran too early.

## How the feed query works

`getActivity` takes the DID it is about as `actor` — which is not necessarily the
signed-in viewer, since `/[handle]/activity/following/` asks for someone else's
following feed — plus a `filter` naming the slice:

| `filter`    | Rows                                                                 |
| ----------- | -------------------------------------------------------------------- |
| `author`    | records `actor` wrote                                                |
| `following` | records written by the accounts `actor` follows, minus `actor`'s own |
| `incoming`  | records by others naming `actor` as their subject                    |
| `all`       | the union of the three (default)                                     |

`db.query` can't filter by a set of DIDs, and it orders by index time rather
than the record's own `createdAt` — which would put backfilled history at the
top. So `getActivity.lua` uses `db.raw`:

1. Resolve the filter to a set of author DIDs — `actor` alone, their follows
   (capped at 500), both, or none — and a subject predicate for the filters that
   include incoming activity.
2. One query over both collections, `WHERE` the author set `OR` the subject
   predicate, ordered by the record's `createdAt` descending, `uri` breaking
   ties. A row matching both sides is still one row, so no dedupe is needed.
3. Fetch `limit + 1` rows; if the extra row exists, return a cursor of
   `<createdAt>::<uri>` and resume with a keyset comparison on the next call.

`following` short-circuits to an empty feed when the actor follows nobody;
`all` does not, since their own and incoming activity still apply.

Adding a new event type to the feed means adding its collection to the
`collection IN (…)` list, mapping its record fields to a `#feedItem`, and — if
it names a subject — widening the incoming clause, which is currently scoped to
follows so the JSON comparison never touches backlog rows.
