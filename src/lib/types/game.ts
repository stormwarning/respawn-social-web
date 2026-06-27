export interface InvolvedCompany {
	developer?: boolean
	publisher?: boolean
	company?: { name?: string }
}

interface Website {
	id: number
	url: string
	type: { id: number; type: string }
}

interface ExternalGame {
	id: number
	url?: string
	external_game_source?: { id: number; name?: string }
}

/**
 * Minimal game shape returned by the backend IGDB proxy.
 * @todo Expand on this.
 */
export interface Game {
	id: number
	name: string
	summary?: string
	cover?: { url: string }
	external_games?: ExternalGame[]
	genres?: Array<{ name: string }>
	involved_companies?: InvolvedCompany[]
	platforms?: Array<{ name: string }>
	websites?: Website[]
	[key: string]: unknown
}
