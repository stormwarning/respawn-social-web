# Lexicons

Drop the app's custom AT Protocol lexicon JSON files here (the canonical copies
live in the backend repo — sync them in once that location is finalised).

Generate TypeScript types into `src/lib/lexicons/` with:

```sh
pnpm codegen
```

This runs `@atcute/lex-cli`. Until lexicons are added, `src/lib/lexicons/` stays
empty and record types fall back to the generic shapes from `@atproto/api`.
