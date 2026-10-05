import {
	GRAIN_GALLERY,
	GRAIN_GALLERY_ITEM,
	GRAIN_PHOTO,
	type AspectRatio,
	type GrainGalleryItemRecord,
	type GrainGalleryRecord,
	type GrainPhotoRecord,
	type GrainRepo,
	type GrainSource,
} from '$lib/atproto/grain'
import type { RecordEnvelope } from '$lib/atproto/records'

/*
 * A pretend PDS with two accounts: one with Grain photos, one without. Blobs are served by
 * picsum.photos: each fake blob CID maps to a picsum image id, cropped to the
 * photo's aspect ratio.
 */

interface PhotoFixture {
	rkey: string
	picsum: number
	aspect: [width: number, height: number]
	alt?: string
	date: string
}

interface GalleryFixture {
	rkey: string
	title: string
	description?: string
	date: string
	/** Photo rkeys in order. Unknown rkeys become items pointing at a deleted photo. */
	photos: string[]
}

interface ActorFixture {
	did: string
	handle: string
	photos: PhotoFixture[]
	galleries: GalleryFixture[]
}

const ACTORS: ActorFixture[] = [
	{
		did: 'did:plc:mockyou7k3ydqlrmxepqsow',
		handle: 'you.example.com',
		photos: [
			{
				rkey: '3m2pnw0001',
				picsum: 10,
				aspect: [3, 2],
				alt: 'Dense pine forest above a calm blue sound, mountains on the far shore.',
				date: '2026-07-02',
			},
			{
				rkey: '3m2pnw0002',
				picsum: 11,
				aspect: [3, 2],
				alt: 'A misty estuary winding through marsh grass between forested hills.',
				date: '2026-07-02',
			},
			{
				rkey: '3m2pnw0003',
				picsum: 13,
				aspect: [3, 2],
				alt: 'Pebble beach curving toward a line of evergreens.',
				date: '2026-07-03',
			},
			{ rkey: '3m2pnw0004', picsum: 16, aspect: [3, 2], date: '2026-07-03' },
			{
				rkey: '3m2pnw0005',
				picsum: 15,
				aspect: [2, 3],
				alt: 'A thin waterfall dropping into a mossy, boulder-filled gorge.',
				date: '2026-07-04',
			},
			{
				rkey: '3m2pnw0006',
				picsum: 1039,
				aspect: [4, 5],
				alt: 'A waterfall pouring over a cliff into a green, fog-wrapped forest valley.',
				date: '2026-07-04',
			},
			{
				rkey: '3m2pnw0007',
				picsum: 1044,
				aspect: [4, 5],
				alt: 'Someone standing on rocks beside a rushing river in a misty canyon.',
				date: '2026-07-05',
			},
			{
				rkey: '3m2pnw0008',
				picsum: 17,
				aspect: [3, 2],
				alt: 'A gravel path between grassy fields leading into tall trees.',
				date: '2026-07-05',
			},
			{
				rkey: '3m2sky0001',
				picsum: 1022,
				aspect: [16, 9],
				alt: 'Green aurora filling the night sky behind a lone spruce.',
				date: '2026-08-11',
			},
			{
				rkey: '3m2sky0002',
				picsum: 1002,
				aspect: [16, 9],
				alt: 'Coastline and turquoise shallows seen from orbit.',
				date: '2026-08-11',
			},
			{
				rkey: '3m2sky0003',
				picsum: 1019,
				aspect: [3, 2],
				alt: 'Storm clouds breaking open over a dark ocean at dusk.',
				date: '2026-08-12',
			},
			{
				rkey: '3m2trp0001',
				picsum: 1015,
				aspect: [3, 2],
				alt: 'A fjord seen from a high cliff edge.',
				date: '2026-05-20',
			},
			{
				rkey: '3m2trp0002',
				picsum: 1036,
				aspect: [3, 2],
				alt: 'A yellow tent pitched in snow below high peaks.',
				date: '2026-05-21',
			},
			{
				rkey: '3m2trp0003',
				picsum: 1043,
				aspect: [3, 2],
				alt: 'Granite cliffs above a forested river valley.',
				date: '2026-05-22',
			},
			{
				rkey: '3m2trp0004',
				picsum: 1016,
				aspect: [3, 2],
				alt: 'Red sandstone canyon walls lit by low sun.',
				date: '2026-05-23',
			},
			{
				rkey: '3m2trp0005',
				picsum: 1018,
				aspect: [3, 2],
				alt: 'A road winding below green ridgelines under heavy cloud.',
				date: '2026-05-24',
			},
			// Uploaded but never added to a gallery.
			{
				rkey: '3m2loose001',
				picsum: 0,
				aspect: [3, 2],
				alt: 'A laptop, phone and coffee cup on a wooden table.',
				date: '2026-09-28',
			},
		],
		galleries: [
			{
				rkey: '3m2galpnw',
				title: 'Pacific Northwest',
				description: 'A week of rain, moss and waterfalls.',
				date: '2026-07-06',
				photos: [
					'3m2pnw0001',
					'3m2pnw0002',
					'3m2pnw0003',
					'3m2pnw0004',
					'3m2pnw0005',
					'3m2pnw0006',
					'3m2pnw0007',
					'3m2pnw0008',
					'3m2sky0003',
					'3m2deleted1',
				],
			},
			{
				rkey: '3m2galsky',
				title: 'Up',
				description: 'Looking at the sky.',
				date: '2026-08-12',
				photos: ['3m2sky0001', '3m2sky0002', '3m2sky0003'],
			},
			{
				rkey: '3m2galtrp',
				title: 'Spring trip',
				date: '2026-05-25',
				photos: ['3m2trp0001', '3m2trp0002', '3m2trp0003', '3m2trp0004', '3m2trp0005'],
			},
		],
	},
	{
		// Signed up for Respawn, never used Grain.
		did: 'did:plc:mocknewbie3x7hq2kd5wfmzla',
		handle: 'new.example.com',
		photos: [],
		galleries: [],
	},
]

const fakeCid = (seed: string) => `bafyreimock${seed.toLowerCase().replace(/[^a-z0-9]/g, '')}`
const fakeBlobCid = (seed: string) => `bafkreimock${seed.toLowerCase().replace(/[^a-z0-9]/g, '')}`
const datetime = (date: string) => `${date}T12:00:00.000Z`

function picsumUrl(id: number, [width, height]: [number, number], size: 'thumb' | 'fullsize') {
	const long = size === 'thumb' ? 480 : 1600
	const scale = long / Math.max(width, height)
	return `https://picsum.photos/id/${id}/${Math.round(width * scale)}/${Math.round(height * scale)}`
}

function buildRepo(actor: ActorFixture): GrainRepo {
	const at = (collection: string, rkey: string) => `at://${actor.did}/${collection}/${rkey}`
	const blobs = new Map<string, PhotoFixture>()

	const photos: RecordEnvelope<GrainPhotoRecord>[] = actor.photos.map((fixture) => {
		const blobCid = fakeBlobCid(fixture.rkey)
		blobs.set(blobCid, fixture)
		const aspectRatio: AspectRatio = { width: fixture.aspect[0], height: fixture.aspect[1] }
		return {
			uri: at(GRAIN_PHOTO, fixture.rkey),
			cid: fakeCid(fixture.rkey),
			rkey: fixture.rkey,
			value: {
				photo: { ref: { $link: blobCid }, mimeType: 'image/jpeg', size: 480_000 },
				...(fixture.alt && { alt: fixture.alt }),
				aspectRatio,
				createdAt: datetime(fixture.date),
			},
		}
	})

	const galleries: RecordEnvelope<GrainGalleryRecord>[] = actor.galleries.map((fixture) => ({
		uri: at(GRAIN_GALLERY, fixture.rkey),
		cid: fakeCid(fixture.rkey),
		rkey: fixture.rkey,
		value: {
			title: fixture.title,
			...(fixture.description && { description: fixture.description }),
			createdAt: datetime(fixture.date),
		},
	}))

	const items: RecordEnvelope<GrainGalleryItemRecord>[] = actor.galleries.flatMap((gallery) =>
		gallery.photos.map((photo, position) => {
			const rkey = `${gallery.rkey}i${position}`
			return {
				uri: at(GRAIN_GALLERY_ITEM, rkey),
				cid: fakeCid(rkey),
				rkey,
				value: {
					gallery: at(GRAIN_GALLERY, gallery.rkey),
					item: at(GRAIN_PHOTO, photo),
					position,
					createdAt: datetime(gallery.date),
				},
			}
		}),
	)

	return {
		did: actor.did,
		handle: actor.handle,
		galleries,
		items,
		photos,
		blobUrl: (cid, size) => {
			const fixture = blobs.get(cid)
			return fixture ? picsumUrl(fixture.picsum, fixture.aspect, size) : ''
		},
	}
}

const REPOS = ACTORS.map(buildRepo)

export const MOCK_HANDLE = ACTORS[0].handle

/** Resolve a mock repo synchronously, for building sample content. */
export function mockRepo(actor: string): GrainRepo {
	const repo = REPOS.find((candidate) => candidate.handle === actor || candidate.did === actor)
	if (!repo) throw new Error(`Mock PDS has no repo for ${actor}`)
	return repo
}

export const MOCK_EMPTY_HANDLE = ACTORS[1].handle

/** Resolve `value` after a little latency, so loading states are visible. */
function later<T>(value: () => T, ms: number): Promise<T> {
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			try {
				resolve(value())
			} catch (error) {
				reject(error)
			}
		}, ms)
	})
}

/** A mock account's Grain records, with a little latency so loading states show. */
export function mockSource(actor: string): GrainSource {
	return {
		hasPhotos: () => later(() => mockRepo(actor).photos.length > 0, 150),
		load: () => later(() => mockRepo(actor), 350),
	}
}
