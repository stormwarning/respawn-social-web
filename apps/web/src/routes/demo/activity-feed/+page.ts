import type { PageLoad } from './$types'

/**
 * The activity rows swap in "You" by comparing against `page.data.user`, so a
 * signed-out visit stands in a demo viewer to show those variants too.
 */
export const load: PageLoad = async ({ parent }) => {
	const { user } = await parent()
	return {
		user: user ?? {
			did: 'did:plc:demoviewer',
			handle: 'you.demo',
			displayName: 'Demo Viewer',
			avatarUrl: null,
		},
	}
}
