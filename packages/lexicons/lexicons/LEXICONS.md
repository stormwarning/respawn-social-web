# Lexicons

## `social.respawn.game`

A Game is an entry in the user’s collection. It stores their current rating,
like state, play state, and references to Logs. There is only a single entry
per Title, but it stores any expansions or editions indicated in Logs.

- rating: number (1–10)
- liked: boolean
- playing: boolean
- played: `'played' | 'completed' | 'abandoned' | 'retired' | 'shelved' | undefined`
- logs: array of refs to `log` records
- cover:
  - image: blob
  - colors
    - dominant: string (hex)

## `social.respawn.list`

A Game can be added to a List. Lists store a name, description, a ranked
setting, and a list of games.

Lists have the same interaction capabilities as Logs.

- name
- description
  - text: string
  - facets
- ranked: boolean
- games:
  - title
  - slug
  - cover
    - image: blob
    - colors
      - dominant: string (hex)

## `social.respawn.feed.like`

## `social.respawn.feed.log`

A Log is a record of a play session. It stores a rating, like state, play
state, expansion or edition, cover image, platform, and optionally a date.

A Log can’t be created for unreleased games.

A Log can include a review. A review is richtext facets or a reference to a
standard.site document. (need to check how feasible it is to render external
posts inline)

A Log can show photos from the author's Grain (grain.social) account, separate
from the review text. Each item references a `social.grain.photo` record and
the gallery it was picked from, which the credit links back to (Grain has no
page for a single photo). Photos deleted on Grain are hidden; edited ones show
their current version.

A review can be marked as containing spoilers (hides review text from current
user until pressing "show", unless current user has the game in their
collection with a `completed` played status). Spans of text within the review
can also be formatted as a spoiler. This will scramble the text stored in
`review.text`; the unscrambled text will be saved in `review.textWithSpoilers`.

A Log can be interacted with by others, based on settings during creation,
similar to Bluesky posts — but only when it has a review. A Log without one
can't be liked or commented on, and the appview ignores likes of it (including
ones left behind after the author removes the review). Comments are similar to replies; they exist in the
commenter’s PDS but the author can choose to hide them.

- game
- edition
- dlc
- platform: string
- cover: blob
- datePlayed: datetime
- startedPlaying: boolean
- finishedPlaying: `'played' | 'completed' | 'abandoned' | 'retired' | 'shelved' | undefined`
- rating: number
- liked: boolean
- review
  - text: string
  - textWithSpoilers: string
  - facets
    - italic
    - bold
    - ul
    - ol
    - blockquote
    - link
    - spoiler
  - external
    - url: string
    - ref: cid
- media: array (max 10)
  - photo: strongRef to a `social.grain.photo` in the author's repo
  - gallery: strongRef to the `social.grain.gallery` it was picked from (optional)

## `social.respawn.feed.comment`

## `social.respawn.graph.follow`

## `social.respawn.graph.block`

## `social.respawn.actor.profile`

Pre-filled from Bluesky profile on creation.

- avatar: blob
- displayName: string
- bio: string
- pronouns: `'they/their' | 'she/her' | 'she/their' | 'he/his' | 'he/their' | 'xe/xyr' | 'ze/hir' | 'ze/zir' | 'it/its'` (open vocabulary; default to `they/their`)
- faves
  - title
  - cover
  - slug
- channel: url
- bsky: url? (maybe this can be just be a DID or something, then a viewer can open the profile in their preferred Bluesky client)
- bskyApp
- adultContent: `'show' | 'blur' | 'hide'` (default to `blur`)

## `social.respawn.backlog.item`

One record per game, rkey is the IGDB id.

- game
  - igdbId
  - slug
  - title
- cover
  - image: blob
  - colors
    - dominant: string (hex)
- releaseDate
- createdAt
