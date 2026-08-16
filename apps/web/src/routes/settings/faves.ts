/** Matches the `maxLength` on social.respawn.actor.profile#faves. */
export const MAX_FAVES = 4

/** One favourite as posted by the faves field, after validation. */
export interface ParsedFave {
	igdbId: number
	slug: string
	title: string
	/** IGDB cover url to upload when the repo has no cover for this game yet. */
	rawCoverUrl: string | null
}

/**
 * Parse the JSON the faves field posts in a single hidden input. Lengths match
 * social.respawn.defs#gameRef so the PDS can't reject what we build from this.
 * Duplicate games are dropped rather than rejected — the picker already blocks
 * them, so a repeat means a stale tab, not something worth failing a save over.
 */
export function parseFaves(raw: string): { error: string } | ParsedFave[] {
	const trimmed = raw.trim()
	if (!trimmed) return []

	let parsed: unknown
	try {
		parsed = JSON.parse(trimmed)
	} catch {
		return { error: 'Invalid favourites.' }
	}
	if (!Array.isArray(parsed)) return { error: 'Invalid favourites.' }
	if (parsed.length > MAX_FAVES) return { error: `You can have at most ${MAX_FAVES} favourites.` }

	const faves: ParsedFave[] = []
	const seen = new Set<number>()

	for (const entry of parsed) {
		if (!entry || typeof entry !== 'object') return { error: 'Invalid favourites.' }
		const { igdbId, slug, title, rawCoverUrl } = entry as Record<string, unknown>

		if (!Number.isInteger(igdbId) || (igdbId as number) < 1) {
			return { error: 'Invalid favourites.' }
		}
		if (typeof slug !== 'string' || !slug.trim() || slug.length > 200) {
			return { error: 'Invalid favourites.' }
		}
		if (typeof title !== 'string' || !title.trim() || title.length > 2000) {
			return { error: 'Invalid favourites.' }
		}
		if (rawCoverUrl != null && typeof rawCoverUrl !== 'string') {
			return { error: 'Invalid favourites.' }
		}

		if (seen.has(igdbId as number)) continue
		seen.add(igdbId as number)

		faves.push({
			igdbId: igdbId as number,
			slug: slug.trim(),
			title: title.trim(),
			rawCoverUrl: (rawCoverUrl as string | null | undefined) || null,
		})
	}

	return faves
}
