import type { PageServerLoad } from './$types'
import { loadGamesPage } from './load'

export const load: PageServerLoad = ({ params, locals }) => loadGamesPage(params.handle, 1, locals)
