import type { Agent } from '@atproto/api'
import { getRecordOrNull, listAllRecords, type RecordEnvelope } from '$lib/atproto/records'

/*
 * Grain (grain.social) photos shown with a log.
 *
 * Grain stores photos as standalone `social.grain.photo` records. A gallery is
 * a `social.grain.gallery` record with no photo list of its own; membership is
 * a `social.grain.gallery.item` join record pointing at a gallery and a photo.
 * All three are public, so reading them needs no OAuth scope.
 */

export const GRAIN_PHOTO = 'social.grain.photo'
export const GRAIN_GALLERY = 'social.grain.gallery'
export const GRAIN_GALLERY_ITEM = 'social.grain.gallery.item'

/** `social.respawn.feed.log` `media` maxLength. */
export const MEDIA_MAX_ITEMS = 10

export interface StrongRef {
	uri: string
	cid: string
}

export interface AspectRatio {
	width: number
	height: number
}

export interface GrainPhotoRecord {
	photo: { ref: { $link: string } | { toString(): string }; mimeType?: string; size?: number }
	alt?: string
	aspectRatio: AspectRatio
	createdAt: string
}

export interface GrainGalleryRecord {
	title: string
	description?: string
	createdAt: string
}

export interface GrainGalleryItemRecord {
	gallery: string
	item: string
	position?: number
	createdAt: string
}

/** One actor's Grain records, as plain JSON (what `/api/viewer/grain/repo` returns). */
export interface GrainRepoData {
	did: string
	handle: string
	pds: string
	galleries: RecordEnvelope<GrainGalleryRecord>[]
	items: RecordEnvelope<GrainGalleryItemRecord>[]
	photos: RecordEnvelope<GrainPhotoRecord>[]
}

/** Repo records plus where to fetch their blobs from. */
export interface GrainRepo extends Omit<GrainRepoData, 'pds'> {
	blobUrl: (cid: string, size: 'thumb' | 'fullsize') => string
}

export interface GalleryRef extends StrongRef {
	title: string
}

/** A photo flattened for display: its strongRef plus what it takes to draw it. */
export interface GrainPhoto extends StrongRef {
	handle: string
	thumb: string
	fullsize: string
	alt?: string
	aspectRatio: AspectRatio
	/** The gallery it was picked from, if any. Grain has no page for a single photo, so this is the link target. */
	gallery?: GalleryRef
}

export interface GrainGallery extends GalleryRef {
	photos: GrainPhoto[]
	/** Items pointing at photos that have since been deleted. */
	missing: number
}

/** The viewer's Grain records, loaded lazily by the photos field. */
export interface GrainSource {
	/**
	 * Whether there are any Grain photos, without listing them: one
	 * `com.atproto.repo.describeRepo` call, whose `collections` names every
	 * collection the repo holds records in.
	 */
	hasPhotos: () => Promise<boolean>
	load: () => Promise<GrainRepo>
}

/** A `social.respawn.feed.log#media` item. */
export interface MediaItem {
	photo: StrongRef
	gallery?: StrongRef
}

/** A media item being edited; svelte-dnd-action keys items by `id`. */
export type MediaDraft = MediaItem & { id: string }

export function rkeyOf(uri: string): string {
	return uri.slice(uri.lastIndexOf('/') + 1)
}

function blobCid(record: GrainPhotoRecord): string {
	const ref = record.photo.ref
	return '$link' in ref ? ref.$link : ref.toString()
}

/** PDS `getBlob` URLs. Grain caps photos at 1MB, so thumb and fullsize are the same blob. */
export function getBlobUrl(pds: string, did: string): GrainRepo['blobUrl'] {
	return (cid) => `${pds}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${cid}`
}

export function toGrainRepo({ pds, ...data }: GrainRepoData): GrainRepo {
	return { ...data, blobUrl: getBlobUrl(pds, data.did) }
}

export function toPhoto(
	repo: Pick<GrainRepo, 'handle' | 'blobUrl'>,
	record: Pick<RecordEnvelope<GrainPhotoRecord>, 'uri' | 'cid' | 'value'>,
): GrainPhoto {
	const cid = blobCid(record.value)
	return {
		uri: record.uri,
		cid: record.cid,
		handle: repo.handle,
		thumb: repo.blobUrl(cid, 'thumb'),
		fullsize: repo.blobUrl(cid, 'fullsize'),
		alt: record.value.alt,
		aspectRatio: record.value.aspectRatio,
	}
}

const toGalleryRef = ({
	uri,
	cid,
	value,
}: Pick<RecordEnvelope<GrainGalleryRecord>, 'uri' | 'cid' | 'value'>): GalleryRef => ({
	uri,
	cid,
	title: value.title,
})

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

/** Galleries, newest first, with their photos. */
export function allGalleries(repo: GrainRepo): GrainGallery[] {
	return repo.galleries
		.toSorted((a, b) => b.value.createdAt.localeCompare(a.value.createdAt))
		.map((record) => Object.assign(toGalleryRef(record), galleryPhotos(repo, record.uri)))
}

/** Galleries holding a photo, newest first. A photo can be in several, or none. */
export function galleriesContaining(repo: GrainRepo, photoUri: string): GalleryRef[] {
	const uris = new Set(
		repo.items.filter((item) => item.value.item === photoUri).map((item) => item.value.gallery),
	)
	return repo.galleries
		.filter((gallery) => uris.has(gallery.uri))
		.toSorted((a, b) => b.value.createdAt.localeCompare(a.value.createdAt))
		.map(toGalleryRef)
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
export function credits(photos: Pick<GrainPhoto, 'handle' | 'gallery'>[]): Credit[] {
	const byAuthor = new Map<string, (GalleryRef | undefined)[]>()
	for (const { handle, gallery } of photos) {
		byAuthor.set(handle, [...(byAuthor.get(handle) ?? []), gallery])
	}
	return [...byAuthor].map(([handle, own]) => {
		const gallery = new Set(own.map((ref) => ref?.uri)).size === 1 ? own[0] : undefined
		return { handle, gallery, href: grainPhotoUrl({ handle, gallery }) }
	})
}

export type ResolvedMedia =
	| {
			/** `updated`: the photo record changed since it was picked (its CID no longer matches). */
			status: 'ok' | 'updated'
			item: MediaItem
			/** The photo as it is now, with its gallery if that still exists. */
			photo: GrainPhoto
			galleryDeleted: boolean
	  }
	| { status: 'deleted'; item: MediaItem }

export interface MediaLookups {
	photo: (uri: string) => GrainPhoto | undefined
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

export function repoLookups(repo: GrainRepo): MediaLookups {
	const photos = new Map(repo.photos.map((record) => [record.uri, record]))
	const galleries = new Map(repo.galleries.map((record) => [record.uri, record]))
	return {
		photo: (uri) => {
			const record = photos.get(uri)
			return record && toPhoto(repo, record)
		},
		gallery: (uri) => {
			const record = galleries.get(uri)
			return record && toGalleryRef(record)
		},
	}
}

/** What a reader sees: deleted photos drop out, the rest show as they are now. */
export function visiblePhotos(resolved: ResolvedMedia[]): GrainPhoto[] {
	return resolved.flatMap((entry) => (entry.status === 'deleted' ? [] : [entry.photo]))
}

function isStrongRef(value: unknown, collection: string, did: string): value is StrongRef {
	if (typeof value !== 'object' || value === null) return false
	const { uri, cid } = value as Record<string, unknown>
	return (
		typeof uri === 'string' &&
		typeof cid === 'string' &&
		cid.length > 0 &&
		cid.length <= 256 &&
		uri === `at://${did}/${collection}/${rkeyOf(uri)}` &&
		/^[A-Za-z0-9._:~-]{1,512}$/.test(rkeyOf(uri))
	)
}

/**
 * Validate `media` posted by the log dialog. Photos and galleries must be in
 * the author's own repo: the picker only offers those, and the credit names
 * the log's author.
 */
export function parseMedia(raw: unknown, did: string): MediaItem[] | { error: string } {
	if (raw == null) return []
	if (!Array.isArray(raw) || raw.length > MEDIA_MAX_ITEMS) return { error: 'Invalid photos.' }
	const items: MediaItem[] = []
	for (const entry of raw) {
		if (typeof entry !== 'object' || entry === null) return { error: 'Invalid photos.' }
		const { photo, gallery } = entry as Record<string, unknown>
		if (!isStrongRef(photo, GRAIN_PHOTO, did)) return { error: 'Invalid photos.' }
		if (gallery != null && !isStrongRef(gallery, GRAIN_GALLERY, did)) {
			return { error: 'Invalid photos.' }
		}
		if (items.some((item) => item.photo.uri === photo.uri)) continue
		items.push({
			photo: { uri: photo.uri, cid: photo.cid },
			...(gallery ? { gallery: { uri: gallery.uri, cid: gallery.cid } } : {}),
		})
	}
	return items
}

// ---------------------------------------------------------------------------
// Repo reads. `agent` can be authed or a public agent on the actor's PDS.
// ---------------------------------------------------------------------------

export async function hasGrainPhotos(agent: Agent, did: string): Promise<boolean> {
	const res = await agent.com.atproto.repo.describeRepo({ repo: did })
	return res.data.collections.includes(GRAIN_PHOTO)
}

export async function listGrainRecords(
	agent: Agent,
	did: string,
): Promise<Pick<GrainRepoData, 'galleries' | 'items' | 'photos'>> {
	const [galleries, items, photos] = await Promise.all([
		listAllRecords<GrainGalleryRecord>(agent, did, GRAIN_GALLERY),
		listAllRecords<GrainGalleryItemRecord>(agent, did, GRAIN_GALLERY_ITEM),
		listAllRecords<GrainPhotoRecord>(agent, did, GRAIN_PHOTO),
	])
	return { galleries, items, photos }
}

/**
 * Resolve a log's media for display: one getRecord per photo and per distinct
 * gallery, in parallel. Missing records count as deleted.
 */
export async function resolveLogMedia(
	agent: Agent,
	repo: Pick<GrainRepo, 'did' | 'handle' | 'blobUrl'>,
	media: MediaItem[],
): Promise<ResolvedMedia[]> {
	// Only the author's own records are fetched; a ref anywhere else (written by
	// some other client) reads as deleted rather than as the wrong record.
	const inRepo = (uri: string, collection: string) =>
		uri === `at://${repo.did}/${collection}/${rkeyOf(uri)}`
	const galleryUris = [
		...new Set(
			media.flatMap((item) =>
				item.gallery && inRepo(item.gallery.uri, GRAIN_GALLERY) ? [item.gallery.uri] : [],
			),
		),
	]
	const own = media.filter((item) => inRepo(item.photo.uri, GRAIN_PHOTO))
	const [photos, galleries] = await Promise.all([
		Promise.all(
			own.map((item) =>
				getRecordOrNull<GrainPhotoRecord>(agent, repo.did, GRAIN_PHOTO, rkeyOf(item.photo.uri)),
			),
		),
		Promise.all(
			galleryUris.map((uri) =>
				getRecordOrNull<GrainGalleryRecord>(agent, repo.did, GRAIN_GALLERY, rkeyOf(uri)),
			),
		),
	])
	const photoByUri = new Map(
		photos.flatMap((record) => (record ? [[record.uri, toPhoto(repo, record)] as const] : [])),
	)
	const galleryByUri = new Map(
		galleries.flatMap((record) => (record ? [[record.uri, toGalleryRef(record)] as const] : [])),
	)
	const lookups: MediaLookups = {
		photo: (uri) => photoByUri.get(uri),
		gallery: (uri) => galleryByUri.get(uri),
	}
	return media.map((item) => resolveMedia(item, lookups))
}
