/** IGDB serves fixed-size variants; the path segment selects one. */
export type CoverSize = 'small' | 'big'

const IGDB_SIZES: Record<CoverSize, string> = {
	/** 180x256 — list thumbnails, where `t_cover_big` is ~40x the pixels needed. */
	small: 't_cover_small_2x',
	/** 264x374 — grid tiles and hero covers, still sharp on a 2x display. */
	big: 't_cover_big',
}

/**
 * Fix cover image URL protocol and target the variant matching the render size.
 */
export function normalizeCoverUrl(url: string, size: CoverSize = 'big'): string {
	return url.replace(/^\/\//, 'https://').replace('/t_thumb/', `/${IGDB_SIZES[size]}/`)
}
