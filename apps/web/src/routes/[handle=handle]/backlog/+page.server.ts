import type { PageServerLoad } from './$types'
import { loadBacklogPage } from './load'

export const load: PageServerLoad = ({ params, locals, setHeaders }) =>
	loadBacklogPage(params.handle, 1, locals, setHeaders)
