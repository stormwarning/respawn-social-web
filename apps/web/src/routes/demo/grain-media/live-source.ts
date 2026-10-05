import {
	GRAIN_PHOTO,
	toGrainRepo,
	type GrainRepo,
	type GrainRepoData,
	type GrainSource,
} from '$lib/atproto/grain'

/**
 * Reads any actor's Grain records without logging in, via this demo's `./repo`
 * and `./collections` endpoints. The app itself only reads the viewer's own,
 * through `/api/viewer/grain`.
 */
export function liveSource(actor: string): GrainSource {
	let repo: Promise<GrainRepo> | undefined
	const query = `actor=${encodeURIComponent(actor)}`
	return {
		async hasPhotos() {
			const res = await fetch(`/demo/grain-media/collections?${query}`)
			if (!res.ok) return false
			const { collections }: { collections: string[] } = await res.json()
			return collections.includes(GRAIN_PHOTO)
		},
		load() {
			repo ??= fetch(`/demo/grain-media/repo?${query}`).then(async (res) => {
				if (!res.ok)
					throw new Error((await res.json().catch(() => null))?.message ?? res.statusText)
				return toGrainRepo((await res.json()) as GrainRepoData)
			})
			return repo
		},
	}
}
