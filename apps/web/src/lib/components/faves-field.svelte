<script lang="ts" module>
/** A favourite game as held in the browser, before it is written to the PDS. */
export interface FaveDraft {
	igdbId: number
	slug: string
	title: string
	/** getBlob url for a saved cover, or the IGDB thumb for a pick made just now. */
	coverUrl: string | null
	/** Untouched IGDB url; only set for fresh picks, and drives the blob upload. */
	rawCoverUrl?: string | null
}

/** What the field posts: the drafts minus anything the server can't use. */
interface FavePayloadItem {
	igdbId: number
	slug: string
	title: string
	rawCoverUrl: string | null
}
</script>

<script lang="ts">
import type { Snippet } from 'svelte'
import { flip } from 'svelte/animate'
import { dndzone, SHADOW_ITEM_MARKER_PROPERTY_NAME } from 'svelte-dnd-action'

import CoverImage from './cover-image.svelte'
import GamePickerDialog, { type GameSearchResult } from './game-picker-dialog.svelte'
import InputField, { type Tone } from './input-field.svelte'
import IconX from './icons/icon-x.svelte'
import IconPlus from './icons/icon-plus.svelte'

interface Props {
	/** The favourites currently saved on the profile. */
	value?: FaveDraft[]
	/** Name of the hidden input carrying the JSON the action parses. */
	name?: string
	/** Matches the `maxLength` on social.respawn.actor.profile#faves. */
	max?: number
	id?: string
	label?: string | Snippet
	tertiaryLabel?: string | Snippet
	description?: string | Snippet
	message?: string | Snippet
	tone?: Tone
	reserveMessageSpace?: boolean
	disabled?: boolean
}

let {
	value = [],
	name = 'faves',
	max = 4,
	id,
	label,
	tertiaryLabel,
	description,
	message = 'Up to 4 · drag to reorder',
	tone,
	reserveMessageSpace,
	disabled,
}: Props = $props()

/** svelte-dnd-action keys items by `id`, so each draft carries one alongside its data. */
type FaveItem = FaveDraft & { id: string; [SHADOW_ITEM_MARKER_PROPERTY_NAME]?: boolean }

const FLIP_DURATION = 200

const toItem = (fave: FaveDraft): FaveItem => ({ ...fave, id: String(fave.igdbId) })

// svelte-ignore state_referenced_locally -- initial seed; edits stay local until submit
let faves = $state<FaveItem[]>(value.map(toItem))

let picker: ReturnType<typeof GamePickerDialog> | undefined = $state()

let pickedIds = $derived(faves.map((fave) => fave.igdbId))

let payload = $derived(
	JSON.stringify(
		faves.map(
			({ igdbId, slug, title, rawCoverUrl }): FavePayloadItem => ({
				igdbId,
				slug,
				title,
				rawCoverUrl: rawCoverUrl ?? null,
			}),
		),
	),
)

function add(game: GameSearchResult) {
	if (faves.length >= max) return
	if (faves.some((fave) => fave.igdbId === game.igdbId)) return
	faves.push(
		toItem({
			igdbId: game.igdbId,
			slug: game.slug,
			title: game.name,
			coverUrl: game.coverUrl,
			rawCoverUrl: game.rawCoverUrl,
		}),
	)
}

function remove(igdbId: number) {
	faves = faves.filter((fave) => fave.igdbId !== igdbId)
}

function sort(event: CustomEvent<{ items: FaveItem[] }>) {
	faves = event.detail.items
}
</script>

<InputField
	{id}
	{label}
	{tertiaryLabel}
	{description}
	{message}
	{tone}
	{reserveMessageSpace}
	{disabled}
>
	{#snippet children(field)}
		<div
			class="row"
			id={field.id}
			role="group"
			aria-label={typeof label === 'string' ? label : 'Favourite games'}
			aria-describedby={field['aria-describedby']}
		>
			{#if faves.length > 0}
				<ul
					class="zone"
					style:--n={faves.length}
					use:dndzone={{
						items: faves,
						flipDurationMs: FLIP_DURATION,
						dragDisabled: disabled,
						// The placeholder below is the only drop affordance we want.
						dropTargetStyle: {},
					}}
					onconsider={sort}
					onfinalize={sort}
				>
					{#each faves as fave (fave.id)}
						<li class="slot" animate:flip={{ duration: FLIP_DURATION }}>
							{#if fave[SHADOW_ITEM_MARKER_PROPERTY_NAME]}
								<div class="tile placeholder"></div>
							{:else}
								<CoverImage image={fave.coverUrl} title={fave.title} />
								<button
									class="clear"
									type="button"
									{disabled}
									aria-label="Remove {fave.title}"
									onclick={() => remove(fave.igdbId)}
								>
									<IconX />
								</button>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}

			{#if faves.length < max}
				<button
					class="slot tile add"
					type="button"
					{disabled}
					aria-label="Add a favourite game"
					onclick={() => picker?.open()}
				>
					<span class="plus" aria-hidden="true">
						<IconPlus />
					</span>
				</button>
			{/if}

			<input type="hidden" {name} value={payload} />
		</div>

		<GamePickerDialog bind:this={picker} excludeIds={pickedIds} onselect={add} />
	{/snippet}
</InputField>

<style>
.row {
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: 12px;
	max-width: 30rem;
	/* Room for the clear buttons, which hang below their tile. */
	padding-bottom: 20px;
}

/* The draggable tiles line up with the row's own columns, so the add slot that
   follows them sits in the next column rather than after a nested track. */
.zone {
	display: grid;
	grid-column: span var(--n);
	grid-template-columns: subgrid;
	gap: 12px;
	padding: 0;
	margin: 0;
	list-style: none;
	border-radius: 4px;

	@supports (corner-shape: squircle) {
		border-radius: 8px;
		corner-shape: var(--corner-shape);
	}

	&:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
}

.slot {
	position: relative;
	aspect-ratio: 3/4;
	border-radius: 4px;

	@supports (corner-shape: squircle) {
		border-radius: 8px;
		corner-shape: var(--corner-shape);
	}

	> :global(.cover) {
		&:hover {
			scale: 1.05;
		}
	}
}

.slot:focus-visible {
	outline: none;

	&:not(#dnd-action-dragged-el) {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
}

.tile {
	width: 100%;
	height: 100%;
	background: var(--color-grey-800);
	border: 1px solid var(--color-grey-600);
	border-radius: 4px;

	@supports (corner-shape: squircle) {
		border-radius: 8px;
		corner-shape: var(--corner-shape);
	}
}

.placeholder {
	position: absolute;
	inset: 0;
	visibility: visible;
	background: transparent;
	border: 0;
	box-shadow: inset 0 0 0 2px var(--color-purple-500);
}

.add {
	display: grid;
	place-items: center;
	padding: 0;
	color: var(--color-text);
	cursor: pointer;

	&:hover:not(:disabled) {
		background: var(--color-grey-700);
	}

	&:disabled {
		opacity: 0.6;
		cursor: default;
	}

	&:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
}

.plus {
	display: grid;
	place-items: center;
	width: 24px;
	height: 24px;
	padding: 4px;
	background: var(--color-grey-600);
	border-radius: 50%;
	box-shadow:
		0 0 4px 2px rgb(0 0 0 / 25%),
		inset 0 2px 0 -1px rgb(255 255 255 / 15%),
		inset 0 -1px 0 0 rgb(0 0 0 / 25%);
}

.clear {
	position: absolute;
	top: calc(100% - 8px);
	left: 50%;
	display: grid;
	place-items: center;
	width: 24px;
	height: 24px;
	padding: 4px;
	color: var(--color-text);
	background: var(--color-grey-600);
	border: none;
	border-radius: 50%;
	box-shadow:
		0 0 4px 2px rgb(0 0 0 / 25%),
		inset 0 2px 0 -1px rgb(255 255 255 / 15%),
		inset 0 -1px 0 0 rgb(0 0 0 / 25%);
	translate: -50% 0;

	&:hover:not(:disabled) {
		background: var(--color-grey-500);
	}

	&:disabled {
		opacity: 0.6;
		cursor: default;
	}

	&:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}

	&:active {
		scale: 0.95;
	}
}
</style>
