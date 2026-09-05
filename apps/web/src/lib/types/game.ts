/**
 * The shapes the backend returns.
 *
 * These mirror `src/titles/read.ts` in respawn-social-api. A `Title` is one
 * game as we present it: the base game with its DLC, ports, remasters and
 * special editions already folded in, its display strings already typeset, and
 * its platform and genre names already renamed. None of that shaping happens
 * here any more — the backend derives it once and serves it to everyone.
 *
 * `v` is the shape version. Assert on it rather than feature-sniffing fields.
 */
export const TITLE_SHAPE_VERSION = 1

export interface TitlePlatform {
	id: number
	/** IGDB's own name, e.g. "PC (Microsoft Windows)". */
	name: string
	/** What we actually show, e.g. "PC". */
	displayName: string
	abbreviation: string | null
	sortOrder: number
}

export interface TitleGenre {
	id: number
	name: string
	displayName: string
}

export interface SimilarTitle {
	id: number
	slug: string
	displayName: string
	coverImageId: string | null
	coverUrl: string | null
}

export interface TitleWebsite {
	url: string
	/** IGDB website type. 1 is the game's official site. */
	type: number | null
}

export interface TitleExternalGame {
	url: string | null
	uid: string | null
	source: number | null
}

/** A pointer to another title, with what it is relative to the one you asked for. */
export interface TitleRef {
	id: number
	slug: string
	displayName: string
	coverImageId: string | null
	coverUrl: string | null
	releaseYear: number | null
	gameType: number | null
	/** "Remake", "Expansion", "Fork" — null on `parent`, see `relationToParent`. */
	relation: string | null
}

/** A game absorbed into a title and given no page of its own. */
export interface FoldedMember {
	id: number
	foldType: 'root' | 'port' | 'dlc' | 'expansion' | 'remaster' | 'version' | 'override'
	/** "DLC", "Expansion", "Remaster", "Edition", "Port". */
	label: string
	/** The full name, e.g. "The Witcher 3: Wild Hunt – Blood and Wine". */
	displayName: string
	/** The name without the parent title's prefix, e.g. "Blood and Wine". */
	shortName: string
	/**
	 * Which member this one hangs off, when that is not the title itself —
	 * "Cataclysm", "Shadowlands". The fold is transitive, so a title can absorb
	 * several editions that share a name while being different products.
	 */
	parentName: string | null
	coverImageId: string | null
	coverUrl: string | null
	releaseYear: number | null
}

export interface Title {
	v: number
	id: number
	slug: string
	/** Raw IGDB text. Render `displayName` instead; this is for matching. */
	name: string
	/** Smart punctuation applied. What the UI shows. */
	displayName: string
	summary: string | null
	summaryDisplay: string | null
	gameType: number
	firstReleaseDate: string | null
	releaseYear: number | null
	coverImageId: string | null
	coverUrl: string | null
	igdbUrl: string
	platforms: TitlePlatform[]
	genres: TitleGenre[]
	developers: string[]
	publishers: string[]
	/** Remasters and special editions, as display strings. */
	editions: string[]
	/** DLC and expansions, as display strings. */
	expansionsNormalized: string[]
	extraCoverImageIds: string[]
	similar: SimilarTitle[]
	websites: TitleWebsite[]
	externalGames: TitleExternalGame[]
	status: 'live' | 'deleted'
	sourceHash: string
	/** Every IGDB id that resolves to this title, including its own. */
	members: number[]
	/** The title this one is a remake/expansion/enhanced release of. */
	parent: TitleRef | null
	/** What this title is relative to `parent`: "Remake", "Expansion", … */
	relationToParent: string | null
	/** Folded in and given no page of their own: DLC, expansions, editions. */
	folded: FoldedMember[]
	/** Descendants that kept their own page. */
	related: TitleRef[]
	/**
	 * Set when the request used a folded child's id. A user's saved record may
	 * point at a DLC that has since folded into its parent; this is how we know
	 * to canonicalise the URL rather than 404.
	 */
	resolvedFrom?: number
}

/** The subset the result lists render. */
export interface TitleSummary {
	v: number
	id: number
	slug: string
	displayName: string
	coverImageId: string | null
	coverUrl: string | null
	releaseYear: number | null
	/** Already-renamed display names. */
	platforms: string[]
}

/**
 * Where a saved IGDB id points now.
 *
 *   members  — the id belongs to a title, as its root or as something folded in
 *   redirect — the game was deleted and the backend worked out its replacement
 *   tombstone— deleted with no known replacement; the title, if any, still
 *              renders from last known data
 *   unknown  — never mirrored
 */
export interface ResolveResult {
	titleId: number | null
	status: 'live' | 'folded' | 'deleted'
	via: 'members' | 'redirect' | 'tombstone' | 'unknown'
	redirectedFrom?: number
}

/** Colours extracted from a cover, keyed by IGDB's content-addressed image id. */
export interface CoverColors {
	/** `#rrggbb`. */
	dominant: string
	/** Most common colours in the artwork, most frequent first. */
	palette: Array<{ hex: string; population: number }> | null
}

export interface SearchHit {
	title: TitleSummary
	/**
	 * The string that actually matched. When `kind` is not `root_name` this is
	 * a DLC, alternative name or edition — worth showing, because otherwise a
	 * search for "blood and wine" returning "The Witcher 3" looks like a bug.
	 */
	matchedTerm: string
	kind: 'root_name' | 'alt_name' | 'member_name' | 'version_title' | 'edition'
	score: number
}

/** One page of the catalogue, from `/games/browse`. */
export interface BrowseResult {
	items: TitleSummary[]
	/** Titles matching the filter, across every page. */
	total: number
	page: number
	pageSize: number
}
