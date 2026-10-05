<script lang="ts">
import { page } from '$app/state'
import {
	allPhotos,
	GRAIN_GALLERY,
	GRAIN_PHOTO,
	repoLookups,
	resolveMedia,
	visiblePhotos,
	type GalleryRef,
	type GrainRepo,
	type MediaDraft,
	type MediaItem,
	type ResolvedMedia,
	type StrongRef,
} from '$lib/atproto/grain'
import GrainCard from '$lib/components/grain-card.svelte'
import GrainMedia from '$lib/components/grain-media.svelte'
import GrainPhotosField from '$lib/components/grain-photos-field.svelte'
import RichTextEditor from '$lib/components/rich-text-editor.svelte'
import RichText from '$lib/components/rich-text.svelte'
import { serialize } from '$lib/richtext/facets'
import type { RichDoc, RichTextValue } from '$lib/richtext/types'
import { liveSource } from './live-source'
import { MOCK_EMPTY_HANDLE, MOCK_HANDLE, mockRepo, mockSource } from './mock-pds'

type Account = 'mock' | 'mock-empty' | 'live'

const REVIEW_MAX_GRAPHEMES = 10000

const repo = mockRepo(MOCK_HANDLE)
const mockPhotos = allPhotos(repo)
const byRkey = (rkey: string) => mockPhotos.find((photo) => photo.uri.endsWith(`/${rkey}`))!

const ref = ({ uri, cid }: StrongRef): StrongRef => ({ uri, cid })
const rkeyOf = (uri: string) => uri.slice(uri.lastIndexOf('/') + 1)
const at = (collection: string, rkey: string) => `at://${repo.did}/${collection}/${rkey}`

const draft = (photo: StrongRef, gallery?: StrongRef): MediaDraft => ({
	id: photo.uri,
	photo: ref(photo),
	...(gallery && { gallery: ref(gallery) }),
})

// --- Samples ---

const p = (...text: (string | { text: string; mark: 'italic' | 'bold' | 'spoiler' })[]) => ({
	type: 'paragraph' as const,
	content: text.map((part) =>
		typeof part === 'string'
			? { type: 'text' as const, text: part }
			: { type: 'text' as const, text: part.text, marks: [{ type: part.mark }] },
	),
})

const REVIEW: RichDoc = {
	type: 'doc',
	content: [
		p(
			'Finally rolled credits on ',
			{ text: 'Outer Wilds', mark: 'italic' },
			'. I played most of it the week after a camping trip, which turned out to be the perfect primer: Timber Hearth looks like every trail I walked that week.',
		),
		p(
			'The sky is what got me, though. Every loop I’d stop at the launch tower and just ',
			{ text: 'look', mark: 'bold' },
			'.',
		),
		p('Best moment: ', { text: 'the sun explodes after 22 minutes', mark: 'spoiler' }, '.'),
	],
}

const pnwRecord = repo.galleries[0]
const pnwRef: GalleryRef = { uri: pnwRecord.uri, cid: pnwRecord.cid, title: pnwRecord.value.title }

const SAMPLE = ['3m2pnw0001', '3m2pnw0006', '3m2pnw0007', '3m2pnw0003'].map((rkey) =>
	draft(byRkey(rkey), pnwRef),
)

/** Things that can happen on Grain after a log is saved. */
const BROKEN_SAMPLE: MediaDraft[] = [
	draft(byRkey('3m2pnw0001'), pnwRef),
	// The photo record was deleted.
	draft({ uri: at(GRAIN_PHOTO, '3m2deleted1'), cid: 'bafyreimock3m2deleted1' }, pnwRef),
	// The photo record was edited (e.g. alt text changed), so its CID moved on.
	draft({ uri: byRkey('3m2pnw0004').uri, cid: 'bafyreimockpicked3m2pnw0004' }, pnwRef),
	// The gallery it was picked from was deleted; the photo survives.
	draft(byRkey('3m2sky0001'), {
		uri: at(GRAIN_GALLERY, '3m2galgone'),
		cid: 'bafyreimock3m2galgone',
	}),
]

// --- Account ---

let account = $state<Account>('mock')
let liveDraft = $state(page.data.user?.handle ?? '')
/** Committed on change, so typing doesn't fire a lookup per keystroke. */
let liveActor = $state(page.data.user?.handle ?? '')

let actor = $derived(
	{ mock: MOCK_HANDLE, 'mock-empty': MOCK_EMPTY_HANDLE, live: liveActor }[account],
)
/** One source per account, shared by the field and the preview so a live repo loads once. */
let source = $derived(account === 'live' ? liveSource(liveActor) : mockSource(actor))

function switchAccount() {
	media = account === 'mock' ? SAMPLE : []
}

// --- Log form ---

let review = $state.raw<RichTextValue>(serialize(REVIEW))
let media = $state.raw<MediaDraft[]>(SAMPLE)

// --- Preview: what a reader of the saved log sees ---

let previewRepo = $state.raw<GrainRepo | undefined>(repo)

$effect(() => {
	const current = source
	if (!media.length) return
	current.load().then(
		(loaded) => {
			if (current === source) previewRepo = loaded
		},
		() => {},
	)
})

let resolved = $derived(
	previewRepo
		? new Map<string, ResolvedMedia>(
				media.map((item) => [item.id, resolveMedia(item, repoLookups(previewRepo!))]),
			)
		: new Map<string, ResolvedMedia>(),
)
let photos = $derived(visiblePhotos([...resolved.values()]))
let problems = $derived([...resolved.values()].some((entry) => describe(entry) !== 'OK'))

function describe(entry: ResolvedMedia): string {
	if (entry.status === 'deleted') return 'Photo deleted: hidden from readers.'
	const notes = []
	if (entry.status === 'updated')
		notes.push('Photo changed since it was picked: shows the current version.')
	if (entry.galleryDeleted) notes.push('Gallery deleted: credit falls back to the profile.')
	return notes.join(' ') || 'OK'
}

/** The parts of the `social.respawn.feed.log` record this page touches. */
let record = $derived({
	review,
	...(media.length && { media: media.map(({ id: _, ...item }): MediaItem => item) }),
})

const layoutCounts = [1, 2, 3, 4, 7]
</script>

<svelte:head>
	<title>Grain photos demo — Respawn</title>
</svelte:head>

<article class="page">
	<header class="intro">
		<h1 class="heading">Grain photos on logs</h1>
		<p class="copy secondary">
			Pick photos from a <a href="https://grain.social" target="_blank" rel="noopener noreferrer"
				>Grain</a
			>
			account to show with a log. The log stores references to the photo records in
			<code>media</code>, next to the review rather than inside it; images are read from Grain,
			never copied.
		</p>
	</header>

	<section class="panel">
		<fieldset class="options">
			<legend class="label">Signed-in account</legend>
			<label class="option">
				<input
					type="radio"
					name="account"
					value="mock"
					bind:group={account}
					onchange={switchAccount}
				/>
				<span>@{MOCK_HANDLE} <span class="copy sm secondary">Mock, has Grain photos</span></span>
			</label>
			<label class="option">
				<input
					type="radio"
					name="account"
					value="mock-empty"
					bind:group={account}
					onchange={switchAccount}
				/>
				<span
					>@{MOCK_EMPTY_HANDLE} <span class="copy sm secondary">Mock, never used Grain</span></span
				>
			</label>
			<label class="option">
				<input
					type="radio"
					name="account"
					value="live"
					bind:group={account}
					onchange={switchAccount}
				/>
				<span>Live account <span class="copy sm secondary">Reads a real repo, no login</span></span>
			</label>
			{#if account === 'live'}
				<input
					class="handle"
					type="text"
					autocomplete="off"
					spellcheck="false"
					placeholder="handle.bsky.social"
					aria-label="Handle"
					bind:value={liveDraft}
					onchange={() => (liveActor = liveDraft.trim().replace(/^@/, ''))}
				/>
			{/if}
		</fieldset>
		{#if account === 'mock'}
			<div class="actions">
				<button type="button" class="button small" onclick={() => (media = SAMPLE)}>
					<span>Load sample</span>
				</button>
				<button type="button" class="button small" onclick={() => (media = BROKEN_SAMPLE)}>
					<span>Load broken refs</span>
				</button>
			</div>
		{/if}
	</section>

	<section class="form">
		<RichTextEditor
			bind:value={review}
			label="Review"
			placeholder="What did you think?"
			maxGraphemes={REVIEW_MAX_GRAPHEMES}
			spoilers
		/>
		<GrainPhotosField bind:items={media} {source} />
		{#await source.hasPhotos() then has}
			{#if !has && !media.length}
				<p class="demo-note copy sm">
					No photos field: @{actor || '…'} has no <code>social.grain.photo</code> records.
				</p>
			{/if}
		{/await}
	</section>

	<section class="demo">
		<h2 class="label">Rendered</h2>
		<div class="preview">
			<RichText value={review} />
			<GrainCard {photos} />
			{#if problems}
				<ul class="resolution copy sm">
					{#each media as item (item.id)}
						{@const entry = resolved.get(item.id)!}
						<li
							class={[
								entry.status === 'deleted' ? 'bad' : describe(entry) === 'OK' ? 'ok' : 'warn',
							]}
						>
							<code>{rkeyOf(item.photo.uri)}</code>
							{describe(entry)}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</section>

	<section class="demo">
		<h2 class="label">Record <code>social.respawn.feed.log</code> (excerpt)</h2>
		<pre class="output">{JSON.stringify(record, null, 2)}</pre>
	</section>

	<section class="demo">
		<h2 class="label">Layouts</h2>
		<p class="copy sm secondary">
			Like Bluesky: up to four photos fill a grid, five or more scroll sideways.
		</p>
		{#each layoutCounts as count (count)}
			<div class="layout">
				<span class="copy sm secondary">{count} {count === 1 ? 'photo' : 'photos'}</span>
				<GrainMedia photos={mockPhotos.slice(0, count)} />
			</div>
		{/each}
	</section>

	<section class="demo notes copy sm">
		<h2 class="label">Notes</h2>
		<p>
			<strong>Showing the field.</strong> The photos field only appears when the account has Grain
			photos. <code>com.atproto.repo.describeRepo</code> returns the collections a repo holds records
			in, so one public call (no records listed) answers it; the picker’s full listing waits until “Add
			photos” is clicked. In the app this would run when the log dialog loads, cached per viewer.
		</p>
		<p>
			<strong>No permissions needed to browse.</strong> Grain records are public in the user’s repo.
			The picker lists <code>social.grain.gallery</code>,
			<code>social.grain.gallery.item</code> and <code>social.grain.photo</code> with
			<code>com.atproto.repo.listRecords</code> and loads images with
			<code>com.atproto.sync.getBlob</code>, both without auth. OAuth scopes only cover writes.
			Private galleries live in a permissioned space (<code>social.grain.privateGallery</code>) and
			are left out, as they shouldn’t appear on a public log.
		</p>
		<p>
			<strong>Any photos, linked back to Grain.</strong> A Grain photo is its own record; a gallery
			only links to photos through <code>gallery.item</code> join records, so <code>media</code> can point
			at photos from any mix of galleries. Grain has no page for a single photo, so each item also stores
			the gallery it was picked from (from “All photos”, its newest gallery). The credit names the gallery
			when all of an author’s photos share one, and links to their profile otherwise.
		</p>
		<p>
			<strong>When Grain changes.</strong> A strongRef pins the version that was picked, and the reader
			checks it against the live record (“Load broken refs”). A deleted photo is hidden from readers and
			shown as a placeholder to the author. A photo whose CID moved on (alt text edited, say) shows its
			current version; re-picking pins the new CID. If the gallery is gone, the credit falls back to the
			author’s profile.
		</p>
		<p>
			<strong>In the app</strong>, this is the Photos field in the log dialog. It is stored as
			<code>media: [{'{ photo, gallery? }'}]</code> on <code>social.respawn.feed.log</code>, and the
			log page resolves it the way the preview above does.
		</p>
	</section>
</article>

<style>
.intro,
.demo,
.form {
	display: grid;
	gap: 12px;
}

.form {
	gap: 24px;
}

.panel {
	display: flex;
	flex-wrap: wrap;
	gap: 16px 32px;
	align-items: start;
	justify-content: space-between;
	padding: 12px;
	background-color: var(--color-grey-800);
	border-radius: 8px;

	@supports (corner-shape: squircle) {
		border-radius: 16px;
		corner-shape: var(--corner-shape);
	}
}

.options {
	display: grid;
	gap: 8px;
	align-content: start;
	padding: 0;
	border: none;
}

.options legend {
	margin-block-end: 12px;
}

.option {
	display: flex;
	gap: 8px;
	align-items: baseline;
}

.handle {
	padding: 6px 12px;
	font: inherit;
	font-size: 1rem;
	color: var(--color-text);
	background: var(--color-grey-900);
	border: 1px solid var(--color-grey-700);
	border-radius: 8px;
}

.secondary {
	color: var(--color-grey-400);
}

.actions {
	display: flex;
	gap: 8px;
	align-items: center;
}

code {
	font-size: 0.875em;
	color: var(--color-grey-100);
}

.demo-note {
	padding: 8px 12px;
	color: var(--color-grey-400);
	border: 1px dashed var(--color-grey-700);
	border-radius: 8px;
}

.preview {
	display: grid;
	gap: 16px;
	padding: 16px;
	border: 1px solid var(--color-grey-700);
	border-radius: 8px;

	@supports (corner-shape: squircle) {
		border-radius: 16px;
		corner-shape: var(--corner-shape);
	}
}

.resolution {
	display: grid;
	gap: 4px;
	padding: 0;
	margin: 0;
	list-style: none;

	li::before {
		margin-inline-end: 6px;
	}

	.ok::before {
		color: var(--color-positive);
		content: '✓';
	}

	.warn::before {
		color: var(--color-caution);
		content: '!';
	}

	.bad::before {
		color: var(--color-critical);
		content: '×';
	}
}

.layout {
	display: grid;
	gap: 6px;
}

.notes p {
	max-inline-size: 70ch;
}

.output {
	max-block-size: 28rem;
	padding: 12px;
	overflow: auto;
	font-size: 0.8125rem;
	color: var(--color-grey-300);
	background: var(--color-grey-950);
	border-radius: 8px;
}
</style>
