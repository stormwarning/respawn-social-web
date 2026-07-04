import type { ParamMatcher } from '@sveltejs/kit'

/** 1-based log number segment: /[handle]/game/[slug]/2/ is the second log. */
export const match: ParamMatcher = (param) => /^[1-9][0-9]*$/.test(param)
