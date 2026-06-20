import type { PageServerLoad } from './$types'

export const load: PageServerLoad = ({ locals }) => {
	// Placeholder feed. Once lexicons are wired, fetch records via locals.agent
	// (e.g. locals.agent.com.atproto.repo.listRecords(...)) here for SSR.
	return {
		loggedIn: !!locals.user,
	}
}
