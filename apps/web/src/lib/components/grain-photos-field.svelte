<script lang="ts">
import { Icon } from '@respawn-social/icons'
import { flip } from 'svelte/animate'
import { dndzone } from 'svelte-dnd-action'
import {
	MEDIA_MAX_ITEMS,
	repoLookups,
	resolveMedia,
	visiblePhotos,
	type GrainPhoto,
	type GrainRepo,
	type GrainSource,
	type MediaDraft,
	type ResolvedMedia,
} from '$lib/atproto/grain'
import FieldLabel from './field-label.svelte'
import GrainPickerDialog from './grain-picker-dialog.svelte'

interface Props {
	items: MediaDraft[]
	/** Where the viewer's Grain records come from. */
	source: GrainSource
	max?: number
}

let { items = $bindable(), source, max = MEDIA_MAX_ITEMS }: Props = $props()

const FLIP_DURATION = 150
const labelId = $props.id()

/** Only offered to accounts with Grain photos, or to a log that already has some. */
let available = $state(false)
let repo = $state.raw<GrainRepo>()
let picker = $state<GrainPickerDialog>()
let loading: Promise<GrainRepo> | undefined

let lookups = $derived(repo && repoLookups(repo))
/** Each item checked against the repo as it is now, keyed by `id`. */
let resolved = $derived(
	lookups &&
		new Map<string, ResolvedMedia>(items.map((item) => [item.id, resolveMedia(item, lookups!)])),
)

$effect(() => {
	let current = true
	source.hasPhotos().then((has) => {
		if (current) available = has
	})
	return () => {
		current = false
	}
})

// Saved items need the repo to show their thumbnails.
$effect(() => {
	if (items.length && !repo) loadRepo().catch(() => {})
})

function loadRepo(): Promise<GrainRepo> {
	loading ??= source.load().then(
		(loaded) => (repo = loaded),
		(error) => {
			loading = undefined
			throw error
		},
	)
	return loading
}

async function add() {
	// The picker starts from what's already chosen, which needs the repo.
	if (items.length) await loadRepo().catch(() => {})
	picker?.open(resolved ? visiblePhotos([...resolved.values()]) : [])
}

const toDraft = (photo: GrainPhoto): MediaDraft => ({
	id: photo.uri,
	photo: { uri: photo.uri, cid: photo.cid },
	...(photo.gallery && { gallery: { uri: photo.gallery.uri, cid: photo.gallery.cid } }),
})
</script>

{#if available || items.length}
	<div class="grain-photos-field" role="group" aria-labelledby={labelId}>
		<FieldLabel
			id={labelId}
			label="Photos"
			description="From your Grain galleries, shown after your review with a credit."
			tertiaryLabel={items.length ? `${items.length} / ${max}` : undefined}
		/>

		{#if items.length}
			<div class="row">
				<ul
					class="strip"
					aria-label="Selected photos, drag to reorder"
					use:dndzone={{ items, flipDurationMs: FLIP_DURATION, dropTargetStyle: {} }}
					onconsider={(event) => (items = event.detail.items)}
					onfinalize={(event) => (items = event.detail.items)}
				>
					{#each items as item (item.id)}
						{@const entry = resolved?.get(item.id)}
						<li class={['tile', entry?.status]} animate:flip={{ duration: FLIP_DURATION }}>
							{#if !entry}
								<span class="visually-hidden">Loading photo</span>
							{:else if entry.status !== 'deleted'}
								<img src={entry.photo.thumb} alt={entry.photo.alt ?? ''} draggable="false" />
								{#if entry.status === 'updated'}<span class="flag">Updated</span>{/if}
								<span class={['from', { gone: entry.galleryDeleted }]}>
									{entry.galleryDeleted
										? 'Gallery deleted'
										: (entry.photo.gallery?.title ?? 'No gallery')}
								</span>
							{:else}
								<span class="gone-photo">Deleted on Grain</span>
							{/if}
							<button
								type="button"
								class="remove"
								aria-label="Remove photo"
								onclick={() => (items = items.filter((other) => other.id !== item.id))}
							>
								<Icon name="x" width="14" height="14" />
							</button>
						</li>
					{/each}
				</ul>
				{#if items.length < max}
					<button type="button" class="tile add" onclick={add}>
						<Icon name="plus" width="20" height="20" />
						<span>Add</span>
					</button>
				{/if}
			</div>
		{:else}
			<button type="button" class="empty" onclick={add}>
				<Icon name="image" width="20" height="20" />
				<span>Add photos from Grain</span>
			</button>
		{/if}
	</div>
{/if}

<GrainPickerDialog
	bind:this={picker}
	load={loadRepo}
	{max}
	onphotos={(photos) => (items = photos.map(toDraft))}
/>

<style>
.grain-photos-field {
	display: grid;
	gap: 8px;
}

.row,
.strip {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}

.strip {
	padding: 0;
	margin: 0;
	list-style: none;
}

.tile {
	position: relative;
	inline-size: 88px;
	block-size: 88px;
	overflow: hidden;
	background: var(--color-grey-800);
	border-radius: 8px;

	@supports (corner-shape: squircle) {
		border-radius: 16px;
		corner-shape: var(--corner-shape);
	}

	img {
		inline-size: 100%;
		block-size: 100%;
		object-fit: cover;
	}

	&.deleted {
		display: grid;
		place-items: center;
		border: 1px dashed var(--color-grey-600);
	}
}

li.tile {
	cursor: grab;
}

.add,
.empty {
	display: flex;
	gap: 8px;
	align-items: center;
	justify-content: center;
	font: inherit;
	font-size: var(--text-sm);
	color: var(--color-grey-300);
	background: transparent;
	border: 1px dashed var(--color-grey-600);

	&:hover {
		color: var(--color-text);
		border-color: var(--color-grey-400);
	}

	&:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
}

.add {
	flex-direction: column;
	gap: 2px;
}

.empty {
	padding: 12px;
	border-radius: 8px;

	@supports (corner-shape: squircle) {
		border-radius: 16px;
		corner-shape: var(--corner-shape);
	}
}

.remove {
	position: absolute;
	inset-block-start: 4px;
	inset-inline-end: 4px;
	display: grid;
	place-items: center;
	inline-size: 22px;
	block-size: 22px;
	padding: 0;
	color: rgb(255 255 255);
	background: rgb(0 0 0 / 65%);
	border: none;
	border-radius: 50%;

	&:focus-visible {
		outline: 2px solid var(--color-accent);
	}
}

.flag {
	position: absolute;
	inset-block-start: 4px;
	inset-inline-start: 4px;
	padding: 1px 5px;
	font-size: 0.6875rem;
	font-weight: 700;
	color: rgb(0 0 0);
	background: var(--color-caution);
	border-radius: 4px;
}

.from {
	position: absolute;
	inset-block-end: 0;
	inset-inline: 0;
	padding: 2px 4px;
	overflow: hidden;
	text-overflow: ellipsis;
	font-size: 0.6875rem;
	color: rgb(255 255 255);
	white-space: nowrap;
	background: rgb(0 0 0 / 60%);

	&.gone {
		color: var(--color-caution);
	}
}

.gone-photo {
	padding: 8px;
	font-size: 0.75rem;
	color: var(--color-grey-400);
	text-align: center;
}

.visually-hidden {
	position: absolute;
	inline-size: 1px;
	block-size: 1px;
	overflow: hidden;
	white-space: nowrap;
	clip-path: inset(50%);
}
</style>
