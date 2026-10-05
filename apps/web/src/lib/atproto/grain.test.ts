import { describe, expect, it } from 'vitest'
import {
	allGalleries,
	credits,
	galleriesContaining,
	getBlobUrl,
	MEDIA_MAX_ITEMS,
	parseMedia,
	repoLookups,
	resolveMedia,
	visiblePhotos,
	type GrainRepo,
} from './grain'

const did = 'did:plc:me'
const photoUri = (rkey: string) => `at://${did}/social.grain.photo/${rkey}`
const galleryUri = (rkey: string) => `at://${did}/social.grain.gallery/${rkey}`

const photo = (rkey: string, createdAt: string) => ({
	uri: photoUri(rkey),
	cid: `cid-${rkey}`,
	rkey,
	value: {
		photo: { ref: { $link: `blob-${rkey}` } },
		alt: `Photo ${rkey}`,
		aspectRatio: { width: 3, height: 2 },
		createdAt,
	},
})
const gallery = (rkey: string, title: string, createdAt: string) => ({
	uri: galleryUri(rkey),
	cid: `cid-${rkey}`,
	rkey,
	value: { title, createdAt },
})
const item = (galleryRkey: string, photoRkey: string, position: number) => ({
	uri: `at://${did}/social.grain.gallery.item/${galleryRkey}${photoRkey}`,
	cid: 'cid',
	rkey: `${galleryRkey}${photoRkey}`,
	value: {
		gallery: galleryUri(galleryRkey),
		item: photoUri(photoRkey),
		position,
		createdAt: '2026-01-01T00:00:00Z',
	},
})

const repo: GrainRepo = {
	did,
	handle: 'me.example.com',
	blobUrl: getBlobUrl('https://pds.example.com', did),
	photos: [photo('a', '2026-01-01'), photo('b', '2026-01-02'), photo('c', '2026-01-03')],
	galleries: [gallery('old', 'Old', '2026-01-01'), gallery('new', 'New', '2026-02-01')],
	items: [item('old', 'b', 1), item('old', 'a', 0), item('old', 'gone', 2), item('new', 'a', 0)],
}

describe('galleries', () => {
	it('lists photos in position order, counting deleted ones', () => {
		const [newest, oldest] = allGalleries(repo)
		expect(newest.title).toBe('New')
		expect(oldest.photos.map((p) => p.uri)).toEqual([photoUri('a'), photoUri('b')])
		expect(oldest.missing).toBe(1)
	})

	it('finds the galleries holding a photo, newest first', () => {
		expect(galleriesContaining(repo, photoUri('a')).map((g) => g.title)).toEqual(['New', 'Old'])
		expect(galleriesContaining(repo, photoUri('c'))).toEqual([])
	})

	it('builds getBlob URLs', () => {
		expect(repoLookups(repo).photo(photoUri('a'))?.thumb).toBe(
			'https://pds.example.com/xrpc/com.atproto.sync.getBlob?did=did%3Aplc%3Ame&cid=blob-a',
		)
	})
})

describe('resolveMedia', () => {
	const lookups = repoLookups(repo)

	it('resolves a photo and its gallery', () => {
		const entry = resolveMedia(
			{
				photo: { uri: photoUri('a'), cid: 'cid-a' },
				gallery: { uri: galleryUri('old'), cid: 'cid-old' },
			},
			lookups,
		)
		expect(entry).toMatchObject({ status: 'ok', galleryDeleted: false })
		expect(entry.status !== 'deleted' && entry.photo.gallery?.title).toBe('Old')
	})

	it('flags deleted photos, edited photos and deleted galleries', () => {
		expect(resolveMedia({ photo: { uri: photoUri('gone'), cid: 'x' } }, lookups).status).toBe(
			'deleted',
		)
		expect(resolveMedia({ photo: { uri: photoUri('a'), cid: 'older' } }, lookups).status).toBe(
			'updated',
		)
		expect(
			resolveMedia(
				{
					photo: { uri: photoUri('a'), cid: 'cid-a' },
					gallery: { uri: galleryUri('x'), cid: 'x' },
				},
				lookups,
			),
		).toMatchObject({ status: 'ok', galleryDeleted: true })
	})

	it('leaves deleted photos out of what readers see', () => {
		const entries = [
			resolveMedia({ photo: { uri: photoUri('gone'), cid: 'x' } }, lookups),
			resolveMedia({ photo: { uri: photoUri('b'), cid: 'cid-b' } }, lookups),
		]
		expect(visiblePhotos(entries).map((p) => p.uri)).toEqual([photoUri('b')])
	})
})

describe('credits', () => {
	const ref = (rkey: string, title: string) => ({ uri: galleryUri(rkey), cid: 'cid', title })

	it('credits a shared gallery', () => {
		const old = ref('old', 'Old')
		expect(
			credits([
				{ handle: 'me', gallery: old },
				{ handle: 'me', gallery: old },
			]),
		).toEqual([{ handle: 'me', gallery: old, href: 'https://grain.social/profile/me/gallery/old' }])
	})

	it('falls back to the profile for mixed or missing galleries', () => {
		expect(
			credits([
				{ handle: 'me', gallery: ref('old', 'Old') },
				{ handle: 'me', gallery: ref('new', 'New') },
			]),
		).toEqual([{ handle: 'me', gallery: undefined, href: 'https://grain.social/profile/me' }])
		expect(credits([{ handle: 'me', gallery: ref('old', 'Old') }, { handle: 'me' }])[0].href).toBe(
			'https://grain.social/profile/me',
		)
	})
})

describe('parseMedia', () => {
	const valid = {
		photo: { uri: photoUri('a'), cid: 'cid-a' },
		gallery: { uri: galleryUri('old'), cid: 'cid-old' },
	}

	it('accepts the author’s own photos and drops duplicates and extra keys', () => {
		expect(parseMedia(undefined, did)).toEqual([])
		expect(parseMedia([{ ...valid, extra: 1 }, valid, { photo: valid.photo }], did)).toEqual([
			{ photo: valid.photo, gallery: valid.gallery },
		])
	})

	it('rejects other repos, other collections and malformed refs', () => {
		const otherRepo = { photo: { uri: 'at://did:plc:else/social.grain.photo/a', cid: 'c' } }
		const otherCollection = { photo: { uri: `at://${did}/app.bsky.feed.post/a`, cid: 'c' } }
		const galleryAsPhoto = { photo: { uri: galleryUri('old'), cid: 'c' } }
		for (const bad of [
			otherRepo,
			otherCollection,
			galleryAsPhoto,
			{ photo: { uri: photoUri('a') } },
		]) {
			expect(parseMedia([bad], did)).toEqual({ error: 'Invalid photos.' })
		}
		expect(parseMedia([{ ...valid, gallery: { uri: photoUri('a'), cid: 'c' } }], did)).toEqual({
			error: 'Invalid photos.',
		})
		expect(parseMedia('nope', did)).toEqual({ error: 'Invalid photos.' })
	})

	it('caps the number of photos', () => {
		const many = Array.from({ length: MEDIA_MAX_ITEMS + 1 }, (_, i) => ({
			photo: { uri: photoUri(`p${i}`), cid: 'c' },
		}))
		expect(parseMedia(many, did)).toEqual({ error: 'Invalid photos.' })
	})
})
