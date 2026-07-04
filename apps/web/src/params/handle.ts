import type { ParamMatcher } from '@sveltejs/kit'

/**
 * Matches an actor segment: a DID (`did:plc:…`) or a handle containing at
 * least one dot (`jeff.bsky.social`). Static routes (`/search`, `/game`,
 * `/settings`, …) take precedence over this param route; the dot requirement
 * keeps single-word paths from being swallowed as handles.
 */
export const match: ParamMatcher = (param) => {
	const value = decodeURIComponent(param).replace(/^@/, '')
	if (value.startsWith('did:')) return /^did:[a-z]+:[a-zA-Z0-9._:%-]+$/.test(value)
	return /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(
		value,
	)
}
