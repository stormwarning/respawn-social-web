# respawn-social-web

Monorepo for a game-focused social app on the **AT Protocol** (pnpm workspaces).

| Workspace           | Purpose                                                        |
| ------------------- | -------------------------------------------------------------- |
| `apps/web`          | SvelteKit frontend (Netlify)                                   |
| `packages/lexicons` | Canonical `social.respawn.*` lexicon schemas + generated types |
| `services/appview`  | HappyView config: feed query script + deployment runbook       |

## Architecture

This app is its own AT Protocol OAuth **confidential client** — it owns auth and
sessions, and talks **directly to the user's PDS** (server-side) for record
CRUD. The separate [`respawn-social-api`](https://github.com/stormwarning/respawn-social-api)
is a pure **API service** (IGDB game data); this app calls it for `/games/*`
only and does **not** use its auth endpoints.

- **SSR-first**: sessions restored in `hooks.server.ts` and exposed on
  `event.locals` (`agent`, `user`), so pages render authed data on the server.
- **OAuth**: `@atproto/oauth-client-node` (Node runtime). State + session stores
  are backed by **Netlify Blobs** (Netlify functions are stateless).
- **Identity / lexicons**: `@atcute/*` for handle/DID resolution;
  `@atproto/lex` for lexicon codegen (in `packages/lexicons`); `@atproto/api`
  `Agent` for PDS XRPC.
- **Hosting**: `adapter-netlify` (Node, `edge: false`).

### Key paths (in `apps/web`)

| Path                                 | Purpose                                            |
| ------------------------------------ | -------------------------------------------------- |
| `src/hooks.server.ts`                | Restore OAuth session → `locals.agent` per request |
| `src/lib/server/oauth/client.ts`     | `NodeOAuthClient` factory + client metadata        |
| `src/lib/server/oauth/blob-store.ts` | State/session stores on Netlify Blobs              |
| `src/lib/server/session.ts`          | HMAC-signed session cookie (DID)                   |
| `src/lib/server/backend.ts`          | Typed fetch wrapper for the backend API            |
| `src/routes/oauth/*`                 | callback, `client-metadata.json`, `jwks.json`      |

Lexicon JSON lives in `packages/lexicons/lexicons/`.

## Setup

> **Node ≥ 22.18** (or ≥ 20.19) required — `oxlint.config.ts` loads via native
> TS. See `.node-version` (`fnm use`).

```sh
pnpm install
cp apps/web/.env.example apps/web/.env
```

Generate the confidential-client signing key and cookie secret:

```sh
node apps/web/scripts/gen-jwk.js   # -> paste into PRIVATE_JWK
openssl rand -hex 32            # -> paste into COOKIE_SECRET
```

### Environment

| Var               | Required | Notes                                                                                             |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `APP_URL`         | prod     | This app's origin. **Unset in dev** → uses the loopback OAuth client (no hosted metadata needed). |
| `BACKEND_API_URL` | yes      | Base URL of the backend API service.                                                              |
| `PRIVATE_JWK`     | prod     | ES256 private JWK (single-line JSON) for `private_key_jwt`.                                       |
| `COOKIE_SECRET`   | yes      | 32+ byte hex, signs the session cookie.                                                           |
| `HAPPYVIEW_URL`   | no       | Base URL of the HappyView appview. Unset → PDS-direct reads only (no following feed).             |

### Appview (`services/appview`)

Cross-user reads (the following feed) come from
[HappyView](https://happyview.dev), a lexicon-driven AppView run as a hosted
service rather than code in this repo: upload lexicons, it indexes matching
records off Jetstream and serves `/xrpc/…`. It indexes
`social.respawn.backlog.item` and `social.respawn.graph.follow`, and serves
`social.respawn.feed.getTimeline` via a Lua query script.

See [`services/appview/README.md`](services/appview/README.md) for the deploy,
lexicon upload, and local-development runbook.

## Develop

```sh
pnpm dev          # http://localhost:5173
pnpm check        # svelte-check / types
pnpm lint         # oxlint
pnpm fmt          # oxfmt (write)  | pnpm fmt:check
pnpm test         # vitest (unit)
pnpm test:e2e     # playwright (smoke)
pnpm codegen      # @atproto/lex -> packages/lexicons/src/lexicons/
```

> **Dev OAuth note:** the loopback client requires the callback host to be
> `127.0.0.1`. The dev redirect is `http://127.0.0.1:5173/oauth/callback`, so
> start the login flow from `http://127.0.0.1:5173` (not `localhost`).

## Deploy (Netlify)

Set `APP_URL`, `BACKEND_API_URL`, `PRIVATE_JWK`, `COOKIE_SECRET` in the site
env. `adapter-netlify` generates the function + redirects; Netlify Blobs is
enabled automatically. Build: `pnpm build` with base directory `apps/web`
(set via the root `netlify.toml`).
