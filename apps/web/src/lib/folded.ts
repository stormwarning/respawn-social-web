import type { FoldedMember } from '$lib/types/game'

/**
 * Naming the games folded into a title.
 *
 * The fold is transitive. World of Warcraft absorbs its expansions, and each
 * expansion's own Collector's Edition comes up with it. Those editions are the
 * expansion sold another way, and the expansion is already listed, so they are
 * dropped (see `groupFolded`).
 *
 * What remains can still collide: editions of editions, or IGDB filing the
 * same name under different parents. Listing those verbatim is noise;
 * collapsing them to one entry claims one product where there are several. So:
 * reduce every name to its bare form, and qualify only the ones that then
 * collide.
 */

/** What each fold type is called in a list, in the order they are shown. */
export const FOLD_ORDER = [
	'original',
	'expansion',
	'dlc',
	'remaster',
	'version',
	'override',
] as const

/** What a group of folded members is; `version` and `override` are both editions. */
export type FoldKind = 'original' | 'expansion' | 'dlc' | 'remaster' | 'edition'

const FOLD_KIND: Record<(typeof FOLD_ORDER)[number], FoldKind> = {
	original: 'original',
	expansion: 'expansion',
	dlc: 'dlc',
	remaster: 'remaster',
	version: 'edition',
	override: 'edition',
}

export const FOLD_HEADING: Record<string, string> = {
	original: 'Original release',
	expansion: 'Expansions',
	dlc: 'DLC',
	remaster: 'Remasters',
	version: 'Editions',
	override: 'Editions',
}

/** Leading separators between a prefix and the name proper. */
const SEPARATOR = /^[\s:–—\-·|]+/

/**
 * A member's name with any prefix it repeats from its own parent removed.
 *
 * IGDB is inconsistent about this: most of WoW's editions are just
 * "Collector's Edition", but Battle for Azeroth's is spelled "WoW: Battle for
 * Azeroth - Collector's Edition". Reducing both to "Collector's Edition" is
 * what lets the next step see that they collide, and spell them alike when it
 * resolves that.
 */
export function baseName(member: Pick<FoldedMember, 'shortName' | 'parentName'>): string {
	const { shortName, parentName } = member
	if (!parentName) return shortName

	const at = shortName.toLowerCase().lastIndexOf(parentName.toLowerCase())
	if (at === -1) return shortName

	const rest = shortName
		.slice(at + parentName.length)
		.replace(SEPARATOR, '')
		.trim()
	// If nothing is left, the member's whole name WAS its parent's; keep it
	// rather than render an empty entry.
	return rest.length > 0 ? rest : shortName
}

/**
 * Name every member of one group, disambiguating only where needed.
 *
 * Only colliding names get qualified. Qualifying unconditionally turns The
 * Witcher 3's "10th Anniversary Edition" — a version of its Complete Edition,
 * and unique either way — into "Complete Edition: 10th Anniversary Edition"
 * for no benefit.
 */
export function nameFoldedGroup(
	members: Array<Pick<FoldedMember, 'shortName' | 'parentName'>>,
): string[] {
	const bases = members.map(baseName)

	const counts = new Map<string, number>()
	for (const base of bases) {
		const key = base.toLowerCase()
		counts.set(key, (counts.get(key) ?? 0) + 1)
	}

	const names: string[] = []
	for (const [index, member] of members.entries()) {
		const base = bases[index] ?? member.shortName
		const collides = (counts.get(base.toLowerCase()) ?? 0) > 1
		const name = collides && member.parentName ? `${member.parentName}: ${base}` : base

		// Anything still identical after that is a real duplicate — IGDB carries a
		// few — and only needs saying once.
		if (!names.some((existing) => existing.toLowerCase() === name.toLowerCase())) {
			names.push(name)
		}
	}
	return names
}

export interface FoldedGroup {
	kind: FoldKind
	heading: string
	names: string[]
}

const isEdition = (m: FoldedMember) => m.foldType === 'version' || m.foldType === 'override'
const isAddOn = (m: FoldedMember) => m.foldType === 'expansion' || m.foldType === 'dlc'

/**
 * Group everything folded into a title, ready to render.
 *
 * Three kinds of member are dropped here rather than in the API, because all
 * are presentation calls rather than facts about the data:
 *
 *   - Ports. They merge platforms and contribute nothing worth listing; "Halo
 *     (Xbox 360)" under Halo is noise.
 *   - Members whose name is just the title's own — 4,430 of them, version
 *     children IGDB filed with no version title. "Includes: Grand Theft Auto V"
 *     on the Grand Theft Auto V page says nothing.
 *   - Editions of an expansion or DLC. WoW's "Cataclysm: Collector's Edition"
 *     is Cataclysm in a bigger box, and Cataclysm is already listed. An edition
 *     of an edition — The Witcher 3's "10th Anniversary Edition" of its
 *     Complete Edition — stays.
 */
export function groupFolded(folded: FoldedMember[], titleName: string): FoldedGroup[] {
	const addOnNames = new Set(folded.filter(isAddOn).map((m) => m.shortName.toLowerCase()))
	const listed = folded.filter(
		(m) =>
			m.shortName.toLowerCase() !== titleName.toLowerCase() &&
			!(isEdition(m) && m.parentName && addOnNames.has(m.parentName.toLowerCase())),
	)

	const groups: Array<{ kind: FoldKind; heading: string; members: FoldedMember[] }> = []

	for (const foldType of FOLD_ORDER) {
		const members = listed.filter((m) => m.foldType === foldType)
		if (members.length === 0) continue

		// `version` and `override` both read as editions, so they share a row.
		const kind = FOLD_KIND[foldType]
		const existing = groups.find((g) => g.kind === kind)
		if (existing) existing.members.push(...members)
		else groups.push({ kind, heading: FOLD_HEADING[foldType] ?? 'Editions', members })
	}

	return groups
		.map(({ kind, heading, members }) => ({ kind, heading, names: nameFoldedGroup(members) }))
		.filter((group) => group.names.length > 0)
}

/**
 * The page's groups as the log dialog offers them: a session is played on one
 * remaster or edition, with any number of expansions and DLC. The original
 * release is a different game, so it is not offered.
 */
export function logOptions(groups: FoldedGroup[]): {
	editions: FoldedGroup[]
	addOns: FoldedGroup[]
} {
	return {
		editions: groups.filter((g) => g.kind === 'remaster' || g.kind === 'edition'),
		addOns: groups.filter((g) => g.kind === 'expansion' || g.kind === 'dlc'),
	}
}
