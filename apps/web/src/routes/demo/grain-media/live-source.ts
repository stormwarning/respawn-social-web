import {
	PHOTO,
	type GalleryItemRecord,
	type GalleryRecord,
	type GrainRepo,
	type GrainSource,
	type PhotoRecord,
	type RecordEnvelope,
} from './grain'

interface RepoResponse {
	did: string
	handle: string
	pds: string
	galleries: RecordEnvelope<GalleryRecord>[]
	items: RecordEnvelope<GalleryItemRecord>[]
	photos: RecordEnvelope<PhotoRecord>[]
}

/**
 * Reads a real actor's Grain records via `./repo`, which lists them from the
 * actor's PDS without auth. Blobs come straight from the PDS too; `getBlob`
 * doesn't resize, so thumbs and fullsize are the same (≤1MB per Grain's lexicon).
 */
export const liveSource: GrainSource = {
	async hasPhotos(actor) {
		const res = await fetch(`/demo/grain-media/collections?actor=${encodeURIComponent(actor)}`)
		if (!res.ok) return false
		const { collections }: { collections: string[] } = await res.json()
		return collections.includes(PHOTO)
	},
	async load(actor) {
		const res = await fetch(`/demo/grain-media/repo?actor=${encodeURIComponent(actor)}`)
		if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? res.statusText)
		const { pds, ...repo }: RepoResponse = await res.json()
		const blobUrl: GrainRepo['blobUrl'] = (cid) =>
			`${pds}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(repo.did)}&cid=${cid}`
		return { ...repo, blobUrl }
	},
}
