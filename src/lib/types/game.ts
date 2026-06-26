export interface InvolvedCompany {
	developer?: boolean
	publisher?: boolean
	company?: { name?: string }
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
	involved_companies?: InvolvedCompany[]
	[key: string]: unknown
}
