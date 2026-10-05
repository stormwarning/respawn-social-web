/*
 * Grain (grain.social) record shapes and helpers for the media demo.
 *
 * Grain stores photos as standalone `social.grain.photo` records. A gallery is
 * a `social.grain.gallery` record with no photo list of its own; membership is
 * a `social.grain.gallery.item` join record pointing at a gallery and a photo.
 */

export const PHOTO = 'social.grain.photo'
export const GALLERY = 'social.grain.gallery'
export const GALLERY_ITEM = 'social.grain.gallery.item'

export interface StrongRef {
	uri: string
	cid: string
}

export interface AspectRatio {
	width: number
	height: number
}

export interface BlobRef {
	$type: 'blob'
	ref: { $link: string }
	mimeType: string
	size: number
}

export interface RecordEnvelope<T> {
	uri: string
	cid: string
	value: T
}

export interface PhotoRecord {
	photo: BlobRef
	alt?: string
	aspectRatio: AspectRatio
	createdAt: string
}

export interface GalleryRecord {
	title: string
	description?: string
	createdAt: string
}

export interface GalleryItemRecord {
	gallery: string
	item: string
	position?: number
	createdAt: string
}

/** Everything the picker needs from one actor's repo. */
export interface GrainRepo {
	did: string
	handle: string
	galleries: RecordEnvelope<GalleryRecord>[]
	items: RecordEnvelope<GalleryItemRecord>[]
	photos: RecordEnvelope<PhotoRecord>[]
	/** Where to fetch a blob from, e.g. the PDS `getBlob` endpoint. */
	blobUrl: (cid: string, size: 'thumb' | 'fullsize') => string
}

export interface GalleryRef extends StrongRef {
	title: string
}

/** A photo flattened for display: the strongRef plus what it takes to draw it. */
export interface GrainPhoto extends StrongRef {
	did: string
	handle: string
	thumb: string
	fullsize: string
	alt?: string
	aspectRatio: AspectRatio
	/** The gallery it was picked from, if any. Grain has no per-photo page, so this is the link target. */
	gallery?: GalleryRef
}

/** What it takes to draw a photo; the strongRef is all that's stored. */
export type PhotoAttrs = Pick<
	GrainPhoto,
	'uri' | 'cid' | 'thumb' | 'fullsize' | 'alt' | 'aspectRatio'
> &
	Partial<Pick<GrainPhoto, 'handle' | 'gallery'>>

export interface GrainGallery extends StrongRef {
	did: string
	handle: string
	title: string
	description?: string
	photos: GrainPhoto[]
	/** Items pointing at photos that have since been deleted. */
	missing: number
}

/** Loads an actor's Grain records. Implemented by the mock PDS and the live reader. */
export interface GrainSource {
	/**
	 * Whether the actor has any Grain photos, without listing them: one
	 * `com.atproto.repo.describeRepo` call, whose `collections` names every
	 * collection the repo holds records in.
	 */
	hasPhotos: (actor: string) => Promise<boolean>
	load: (actor: string) => Promise<GrainRepo>
}

export function rkeyOf(uri: string): string {
	return uri.split('/').pop() ?? ''
}

export function toPhoto(repo: GrainRepo, record: RecordEnvelope<PhotoRecord>): GrainPhoto {
	const cid = record.value.photo.ref.$link
	return {
		uri: record.uri,
		cid: record.cid,
		did: repo.did,
		handle: repo.handle,
		thumb: repo.blobUrl(cid, 'thumb'),
		fullsize: repo.blobUrl(cid, 'fullsize'),
		alt: record.value.alt,
		aspectRatio: record.value.aspectRatio,
	}
}

/** All photos, newest first. */
export function allPhotos(repo: GrainRepo): GrainPhoto[] {
	return repo.photos
		.toSorted((a, b) => b.value.createdAt.localeCompare(a.value.createdAt))
		.map((record) => toPhoto(repo, record))
}

/** URIs of photos that belong to at least one gallery. */
export function photosInGalleries(repo: GrainRepo): Set<string> {
	const photos = new Set(repo.photos.map((photo) => photo.uri))
	return new Set(repo.items.map((item) => item.value.item).filter((uri) => photos.has(uri)))
}

/**
 * A gallery's photos in order. Items pointing at deleted photos are skipped and
 * counted, since nothing stops a photo being deleted out from under a gallery.
 */
export function galleryPhotos(
	repo: GrainRepo,
	galleryUri: string,
): { photos: GrainPhoto[]; missing: number } {
	const byUri = new Map(repo.photos.map((photo) => [photo.uri, photo]))
	const items = repo.items
		.filter((item) => item.value.gallery === galleryUri)
		.toSorted((a, b) => (a.value.position ?? 0) - (b.value.position ?? 0))
	const photos: GrainPhoto[] = []
	let missing = 0
	for (const item of items) {
		const photo = byUri.get(item.value.item)
		if (photo) photos.push(toPhoto(repo, photo))
		else missing++
	}
	return { photos, missing }
}

export function toGallery(repo: GrainRepo, record: RecordEnvelope<GalleryRecord>): GrainGallery {
	return {
		uri: record.uri,
		cid: record.cid,
		did: repo.did,
		handle: repo.handle,
		title: record.value.title,
		description: record.value.description,
		...galleryPhotos(repo, record.uri),
	}
}

/** Galleries holding a photo, newest first. A photo can be in several, or none. */
export function galleriesContaining(repo: GrainRepo, photoUri: string): GalleryRef[] {
	const uris = new Set(
		repo.items.filter((item) => item.value.item === photoUri).map((item) => item.value.gallery),
	)
	return repo.galleries
		.filter((gallery) => uris.has(gallery.uri))
		.toSorted((a, b) => b.value.createdAt.localeCompare(a.value.createdAt))
		.map(({ uri, cid, value }) => ({ uri, cid, title: value.title }))
}

export function grainGalleryUrl(handle: string, uri: string): string {
	return `https://grain.social/profile/${handle}/gallery/${rkeyOf(uri)}`
}

export function grainProfileUrl(handle: string): string {
	return `https://grain.social/profile/${handle}`
}

/** Where a photo links on Grain: its gallery when known, else its author's profile. */
export function grainPhotoUrl(photo: Pick<GrainPhoto, 'handle' | 'gallery'>): string {
	return photo.gallery
		? grainGalleryUrl(photo.handle, photo.gallery.uri)
		: grainProfileUrl(photo.handle)
}

export interface Credit {
	handle: string
	href: string
	/** Set when every photo by this author came from the same gallery. */
	gallery?: GalleryRef
}

/** One credit per author, in order of first appearance. */
export function credits(photos: Partial<Pick<GrainPhoto, 'handle' | 'gallery'>>[]): Credit[] {
	const byAuthor = new Map<string, (GalleryRef | undefined)[]>()
	for (const { handle, gallery } of photos) {
		if (handle) byAuthor.set(handle, [...(byAuthor.get(handle) ?? []), gallery])
	}
	return [...byAuthor].map(([handle, own]) => {
		const gallery = new Set(own.map((ref) => ref?.uri)).size === 1 ? own[0] : undefined
		return { handle, gallery, href: grainPhotoUrl({ handle, gallery }) }
	})
}

/** Proposed `social.respawn.feed.log#media` item: a photo, plus the gallery it was picked from. */
export interface MediaItem {
	photo: StrongRef
	gallery?: StrongRef
}

/** A media item being edited; svelte-dnd-action keys items by `id`. */
export type MediaDraft = MediaItem & { id: string }

export type ResolvedMedia =
	| {
			/** `updated`: the photo record changed since it was picked (its CID no longer matches). */
			status: 'ok' | 'updated'
			item: MediaItem
			/** The photo as it is now, with its gallery if that still exists. */
			photo: PhotoAttrs
			galleryDeleted: boolean
	  }
	| { status: 'deleted'; item: MediaItem }

export interface MediaLookups {
	photo: (uri: string) => PhotoAttrs | undefined
	gallery: (uri: string) => GalleryRef | undefined
}

/**
 * Check a stored item against the author's repo. A strongRef pins the version
 * that was picked, but Grain records can change or disappear afterwards.
 */
export function resolveMedia(item: MediaItem, lookups: MediaLookups): ResolvedMedia {
	const current = lookups.photo(item.photo.uri)
	if (!current) return { status: 'deleted', item }
	const gallery = item.gallery ? lookups.gallery(item.gallery.uri) : undefined
	return {
		status: current.cid === item.photo.cid ? 'ok' : 'updated',
		item,
		photo: { ...current, gallery },
		galleryDeleted: !!item.gallery && !gallery,
	}
}
