/**
 * The pronoun options offered in settings. Mirrors the `knownValues` on
 * `pronouns` in `packages/lexicons/lexicons/social/respawn/actor/profile.json`.
 * The lexicon vocabulary is open, so records from other clients may carry
 * values outside this list; we fall back to the default when that happens.
 */
export const PRONOUN_VALUES = [
	'they/their',
	'she/her',
	'she/their',
	'he/his',
	'he/their',
	'xe/xyr',
	'ze/hir',
	'ze/zir',
	'it/its',
] as const

export type Pronouns = (typeof PRONOUN_VALUES)[number]

export const DEFAULT_PRONOUNS: Pronouns = 'they/their'

export function isPronouns(value: string | undefined): value is Pronouns {
	return PRONOUN_VALUES.includes(value as Pronouns)
}
