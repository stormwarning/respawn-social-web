import type { PageServerLoad } from './$types'
import { loadHandleActivity } from '../load'

export const load: PageServerLoad = async (event) =>
	loadHandleActivity(event.params.handle, 'following', '/activity/', event)
