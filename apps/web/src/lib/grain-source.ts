import { toGrainRepo, type GrainRepoData, type GrainSource } from '$lib/atproto/grain'

/**
 * Whether the viewer has Grain photos, asked once per page load: the log
 * dialog re-mounts its fields on every open, and the answer rarely changes.
 */
let hasPhotos: Promise<boolean> | undefined

/** The signed-in viewer's Grain records, via `/api/viewer/grain`. */
export const viewerGrainSource: GrainSource = {
	hasPhotos() {
		hasPhotos ??= fetch('/api/viewer/grain')
			.then(async (res) => res.ok && ((await res.json()) as { hasPhotos: boolean }).hasPhotos)
			.catch(() => false)
		return hasPhotos
	},
	async load() {
		const res = await fetch('/api/viewer/grain/repo')
		if (!res.ok) throw new Error('Couldn’t load your Grain photos.')
		return toGrainRepo((await res.json()) as GrainRepoData)
	},
}
