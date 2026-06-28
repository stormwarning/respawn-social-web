# Lexicons

## `social.respawn.game`

A Game is an entry in the user’s collection. It stores their current rating, like state, play state, and references to Logs. There is only a single entry per Title, but it stores any expansions or editions indicated in Logs.

- rating: number (1–10)
- liked: boolean
- playing: boolean
- played: `'played' | 'completed' | 'abandoned' | 'retired' | 'shelved' | null`
- logs: array of refs to `log` records
- cover:
  - image: blob
  - colors
    - dominant: string (hex)

## `social.respawn.feed.like`

## `social.respawn.feed.log`

## `social.respawn.feed.comment`

## `social.respawn.graph.follow`

## `social.respawn.graph.block`
