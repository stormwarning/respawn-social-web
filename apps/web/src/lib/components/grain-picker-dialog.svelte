<script lang="ts">
import { Icon } from '@respawn-social/icons'
import {
	allGalleries,
	allPhotos,
	galleriesContaining,
	MEDIA_MAX_ITEMS,
	photosInGalleries,
	type GalleryRef,
	type GrainGallery,
	type GrainPhoto,
	type GrainRepo,
} from '$lib/atproto/grain'

type Tab = 'galleries' | 'photos'

interface Props {
	/** The viewer's Grain records; called on every open, so it should cache. */
	load: () => Promise<GrainRepo>
	/** Most photos one selection may hold. */
	max?: number
	/** Each photo carries the gallery it was picked from, for linking back to Grain. */
	onphotos: (photos: GrainPhoto[]) => void
}

let { load, max = MEDIA_MAX_ITEMS, onphotos }: Props = $props()

// oxlint-disable-next-line no-unassigned-vars
let dialog: HTMLDialogElement
let tab = $state<Tab>('galleries')
let repo = $state.raw<GrainRepo>()
let loading = $state(false)
let error = $state('')
let openGallery = $state<string>()
let selected = $state.raw<GrainPhoto[]>([])

let galleries = $derived(repo ? allGalleries(repo) : [])
let photos = $derived(repo ? allPhotos(repo) : [])
let grouped = $derived(repo ? photosInGalleries(repo) : new Set<string>())
let current = $derived(galleries.find((gallery) => gallery.uri === openGallery))
const tabs: [Tab, string][] = [
	['galleries', 'Galleries'],
	['photos', 'All photos'],
]

type Context = (photo: GrainPhoto) => GalleryRef | undefined

const galleryRef = ({ uri, cid, title }: GrainGallery): GalleryRef => ({ uri, cid, title })
/** Picked from "All photos": credit its newest gallery, if it's in one. */
const newestGallery: Context = (photo) =>
	repo ? galleriesContaining(repo, photo.uri)[0] : undefined

export async function open(initial: GrainPhoto[] = []) {
	selected = initial
	dialog.showModal()
	if (repo) return
	loading = true
	error = ''
	try {
		repo = await load()
	} catch (cause) {
		error = cause instanceof Error ? cause.message : String(cause)
	} finally {
		loading = false
	}
}

function reset() {
	tab = 'galleries'
	openGallery = undefined
}

const isSelected = (photo: GrainPhoto) => selected.some((other) => other.uri === photo.uri)

function toggle(photo: GrainPhoto, context: Context) {
	if (isSelected(photo)) selected = selected.filter((other) => other.uri !== photo.uri)
	else if (selected.length < max) selected = [...selected, { ...photo, gallery: context(photo) }]
}

function selectAll(gallery: GrainGallery) {
	const room = max - selected.length
	const added = gallery.photos
		.filter((photo) => !isSelected(photo))
		.slice(0, room)
		.map((photo) => Object.assign({ gallery: galleryRef(gallery) }, photo))
	selected = [...selected, ...added]
}

function done() {
	onphotos(selected)
	dialog.close()
}

/** Close when the backdrop (the dialog element itself) is clicked. */
function onclick(event: MouseEvent) {
	if (event.target === dialog) dialog.close()
}
</script>

{#snippet grid(list: GrainPhoto[], context: Context, badges = false)}
	<ul class="grid">
		{#each list as photo (photo.uri)}
			{@const order = selected.findIndex((other) => other.uri === photo.uri)}
			<li>
				<button
					type="button"
					class="photo"
					aria-pressed={order !== -1}
					disabled={order === -1 && selected.length >= max}
					onclick={() => toggle(photo, context)}
				>
					<img src={photo.thumb} alt={photo.alt ?? 'Photo without a description'} loading="lazy" />
					{#if order !== -1}<span class="order">{order + 1}</span>{/if}
					{#if badges && !grouped.has(photo.uri)}<span class="badge">Not in a gallery</span>{/if}
				</button>
			</li>
		{/each}
	</ul>
{/snippet}

{#snippet selectAllButton(gallery: GrainGallery)}
	<button
		type="button"
		class="button small select-all"
		disabled={gallery.photos.every(isSelected) || selected.length >= max}
		onclick={() => selectAll(gallery)}><span>Select all</span></button
	>
{/snippet}

{#snippet galleryList(list: GrainGallery[])}
	<ul class="galleries">
		{#each list as gallery (gallery.uri)}
			<li>
				<button type="button" class="gallery" onclick={() => (openGallery = gallery.uri)}>
					<span class="cover">
						{#each gallery.photos.slice(0, 3) as photo (photo.uri)}
							<img src={photo.thumb} alt="" loading="lazy" />
						{/each}
					</span>
					<span class="gallery-text">
						<span class="name">{gallery.title}</span>
						<span class="meta">
							{gallery.photos.length}
							{gallery.photos.length === 1 ? 'photo' : 'photos'}
							{#if gallery.missing}· {gallery.missing} missing{/if}
						</span>
					</span>
				</button>
			</li>
		{/each}
	</ul>
{/snippet}

<dialog bind:this={dialog} {onclick} onclose={reset} aria-label="Add photos from Grain">
	<div class="dialog-content">
		<div class="dialog-header">
			<h2>Add photos from Grain</h2>
			{#if repo}<span class="meta">@{repo.handle}</span>{/if}
			<button class="close" type="button" onclick={() => dialog.close()} aria-label="Close">
				<Icon name="x" width="24" height="24" />
			</button>
		</div>

		<div class="tabs" role="tablist">
			{#each tabs as [key, label] (key)}
				<button
					type="button"
					role="tab"
					class="tab"
					aria-selected={tab === key}
					onclick={() => {
						tab = key
						openGallery = undefined
					}}>{label}</button
				>
			{/each}
		</div>

		<div class="body" role="tabpanel">
			{#if loading}
				<p class="copy sm meta">Loading your Grain photos…</p>
			{:else if error}
				<p class="copy sm error">{error}</p>
			{:else if tab === 'photos'}
				{#if photos.length}{@render grid(photos, newestGallery, true)}{:else}<p
						class="copy sm meta"
					>
						No photos.
					</p>{/if}
			{:else if current}
				<div class="crumb">
					<button type="button" class="button small" onclick={() => (openGallery = undefined)}>
						<span>← Galleries</span>
					</button>
					<span class="name">{current.title}</span>
					{#if current.missing}<span class="meta">{current.missing} photo deleted</span>{/if}
					{@render selectAllButton(current)}
				</div>
				{@render grid(current.photos, () => galleryRef(current!))}
			{:else if galleries.length}
				{@render galleryList(galleries)}
			{:else}
				<p class="copy sm meta">No public galleries.</p>
			{/if}
		</div>

		<div class="footer">
			<span class="meta">{selected.length} / {max} selected</span>
			{#if selected.length}
				<button type="button" class="button small" onclick={() => (selected = [])}>
					<span>Clear</span>
				</button>
			{/if}
			<button type="button" class="button small primary" onclick={done}>
				<span>Done</span>
			</button>
		</div>
	</div>
</dialog>

<style>
dialog {
	inline-size: min(40rem, 100vi - 2rem);
	max-inline-size: none;
	padding: 0;
	margin: auto;
	color: var(--color-text);
	background: var(--color-grey-800);
	border: 1px solid var(--color-border);
	border-radius: 8px;
	opacity: 1;
	transition:
		opacity 200ms ease-out,
		translate 200ms ease-out,
		display 200ms allow-discrete,
		overlay 200ms allow-discrete;

	@supports (corner-shape: squircle) {
		border-radius: 16px;
		corner-shape: var(--corner-shape);
	}
}

dialog:not([open]) {
	opacity: 0;
	translate: 0 -4px;
}

@starting-style {
	dialog[open] {
		opacity: 0;
		translate: 0 -4px;
	}
}

dialog::backdrop {
	background: rgb(0 0 0 / 40%);
}

.dialog-content {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
	padding: 16px;
}

.meta {
	font-size: var(--text-sm);
	color: var(--color-muted);
}

.dialog-header {
	display: flex;
	gap: var(--space-2);
	align-items: center;

	h2 {
		font-size: var(--text-base);
		font-weight: 600;
	}

	.meta {
		flex: 1;
	}
}

.close {
	display: flex;
	padding: 4px;
	margin-inline-start: auto;
	color: var(--color-grey-300);
	background: transparent;
	border: none;
	border-radius: 4px;

	&:focus-visible {
		outline: 2px solid var(--color-accent);
	}
}

.tabs {
	display: flex;
	gap: 4px;
	border-block-end: 1px solid var(--color-grey-700);
}

.tab {
	padding: 6px 10px;
	margin-block-end: -1px;
	font: inherit;
	font-size: var(--text-sm);
	color: var(--color-grey-400);
	background: none;
	border: none;
	border-block-end: 2px solid transparent;

	&:focus-visible {
		outline: 2px solid var(--color-accent);
	}

	&[aria-selected='true'] {
		color: var(--color-text);
		border-block-end-color: var(--color-accent);
	}
}

.body {
	display: grid;
	gap: var(--space-2);
	align-content: start;
	min-block-size: 16rem;
	max-block-size: 55vb;
	overflow-block: auto;
}

.grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
	gap: 6px;
	padding: 2px;
	margin: 0;
	list-style: none;
}

.cover {
	display: grid;
	flex: none;
	grid-template-rows: 1fr 1fr;
	grid-template-columns: 2fr 1fr;
	gap: 2px;
	inline-size: 72px;
	block-size: 48px;
	overflow: hidden;
	background: var(--color-grey-900);
	border-radius: 4px;

	img {
		inline-size: 100%;
		block-size: 100%;
		object-fit: cover;
	}

	> :first-child {
		grid-row: span 2;
	}
}

.photo {
	position: relative;
	display: block;
	inline-size: 100%;
	aspect-ratio: 1;
	padding: 0;
	overflow: hidden;
	background: var(--color-grey-900);
	border: none;
	border-radius: 6px;

	img {
		inline-size: 100%;
		block-size: 100%;
		object-fit: cover;
		transition: scale 150ms ease-out;
	}

	&:disabled {
		opacity: 0.4;
	}

	&:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}

	&[aria-pressed='true'] {
		outline: 3px solid var(--color-accent);
		outline-offset: -3px;

		img {
			scale: 0.92;
		}
	}
}

.order {
	position: absolute;
	inset-block-start: 6px;
	inset-inline-end: 6px;
	display: grid;
	place-items: center;
	inline-size: 22px;
	block-size: 22px;
	font-size: 0.75rem;
	font-weight: 700;
	font-variant-numeric: tabular-nums;
	color: rgb(255 255 255);
	background: var(--color-accent);
	border-radius: 50%;
}

.badge {
	position: absolute;
	inset-block-end: 6px;
	inset-inline-start: 6px;
	padding: 1px 5px;
	font-size: 0.6875rem;
	color: rgb(255 255 255);
	background: rgb(0 0 0 / 65%);
	border-radius: 4px;
}

.galleries {
	display: grid;
	gap: 4px;
	padding: 0;
	margin: 0;
	list-style: none;
}

.gallery {
	display: flex;
	gap: var(--space-2);
	align-items: center;
	inline-size: 100%;
	padding: 6px;
	font: inherit;
	color: inherit;
	text-align: start;
	background: transparent;
	border: none;
	border-radius: 8px;

	&:hover {
		background: var(--color-grey-700);
	}

	&:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: -2px;
	}
}

.gallery-text {
	display: grid;
	flex: 1;
	min-inline-size: 0;
}

.name {
	overflow: hidden;
	text-overflow: ellipsis;
	font-weight: 600;
	white-space: nowrap;
}

.crumb {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-2);
	align-items: center;
}

.select-all {
	margin-inline-start: auto;
}

.error {
	color: var(--color-critical);
}

.footer {
	display: flex;
	gap: var(--space-2);
	align-items: center;

	.meta {
		flex: 1;
		font-variant-numeric: tabular-nums;
	}
}
</style>
