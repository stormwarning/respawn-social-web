<script lang="ts">
import { Icon } from '@respawn-social/icons'
import {
	activityVerb,
	emptyLogForm,
	toLogRecord,
	today,
	type CurrentPlayState,
	type LogFormValue,
	type LogGame,
	type LogResult,
} from '$lib/log-form'
import type { FoldedGroup } from '$lib/folded'
import { countGraphemes } from '$lib/richtext/facets'
import CoverImage from './cover-image.svelte'
import Divider from './divider.svelte'
import EditionMenu from './edition-menu.svelte'
import FieldLabel from './field-label.svelte'
import LikeButton from './like-button.svelte'
import PlayStateMenu from './play-state-menu.svelte'
import ReplygateMenu from './replygate-menu.svelte'
import RichTextEditor from './rich-text-editor.svelte'
import SelectField from './select-field.svelte'
import StarRating from './star-rating.svelte'
import TextInput from './text-input.svelte'

interface Props {
	game: LogGame
	/** An existing log to edit. Without one the dialog creates a new log. */
	value?: LogFormValue
	/** The viewer's current state for the game; picks the progress defaults for a new log. */
	currentState?: CurrentPlayState
	/** Who the feed preview names. */
	actor?: string
	/** The game's platforms, e.g. from IGDB. The field is hidden without any. */
	platforms?: string[]
	/** The game's remasters and editions. Shares a menu with DLC, hidden when both are empty. */
	editionGroups?: FoldedGroup[]
	/** The game's expansions and DLC. Shares a menu with editions, hidden when both are empty. */
	dlcGroups?: FoldedGroup[]
	/** Called with the record and replygate settings just before the dialog closes. */
	onsave: (result: LogResult) => void
	/** Offered in edit mode only. */
	ondelete?: () => void
}

let {
	game,
	value,
	currentState,
	actor = 'You',
	platforms = [],
	editionGroups = [],
	dlcGroups = [],
	onsave,
	ondelete,
}: Props = $props()

const REVIEW_MAX_GRAPHEMES = 10000

const uid = $props.id()
const titleId = `${uid}--title`

// oxlint-disable-next-line no-unassigned-vars
let dialog: HTMLDialogElement
let formEl = $state<HTMLFormElement>()
let form = $state<LogFormValue>(emptyLogForm())
/** Bumped on every open, so the fields (and the editor) start fresh. */
let session = $state(0)
let confirmingDelete = $state(false)

let editing = $derived(value !== undefined)
// A log's saved choice stays pickable even if the game's data no longer lists it.
let platformOptions = $derived(withSaved(platforms, value?.platform ? [value.platform] : []))
let editionOptions = $derived(
	withSavedInGroups(editionGroups, value?.edition ? [value.edition] : [], {
		kind: 'edition',
		heading: 'Editions',
	}),
)
let dlcOptions = $derived(
	withSavedInGroups(dlcGroups, value?.dlc ?? [], { kind: 'dlc', heading: 'DLC' }),
)
let verb = $derived(activityVerb(toLogRecord(form, game).log))
let hasReviewText = $derived(form.review.text.trim() !== '')
let overLimit = $derived(
	Math.max(countGraphemes(form.review.text), countGraphemes(form.review.textWithSpoilers ?? '')) >
		REVIEW_MAX_GRAPHEMES,
)

/** Wording follows the current state: a finished game can only be replayed. */
let started = $derived.by(() => {
	if (editing || !currentState) return { label: 'Started a new playthrough', hint: '' }
	if (currentState.playing)
		return { label: 'Started a new playthrough', hint: 'You’re already playing this' }
	if (currentState.played) return { label: 'Started a replay', hint: '' }
	return { label: 'Started playing', hint: '' }
})

function withSaved(options: string[], saved: string[]) {
	return [...options, ...saved.filter((item) => !options.includes(item))]
}

/**
 * Saved choices the game no longer lists — including names stored before they
 * were normalized — join the last group, or a group of their own when there
 * is none.
 */
function withSavedInGroups(
	groups: FoldedGroup[],
	saved: string[],
	fallback: Omit<FoldedGroup, 'names'>,
): FoldedGroup[] {
	const missing = saved.filter((item) => !groups.some((group) => group.names.includes(item)))
	if (!missing.length) return groups
	const last = groups.at(-1)
	if (!last) return [{ ...fallback, names: missing }]
	return [...groups.slice(0, -1), { ...last, names: withSaved(last.names, missing) }]
}

export function open() {
	form = value ? structuredClone($state.snapshot(value)) : emptyLogForm(currentState)
	confirmingDelete = false
	session += 1
	dialog.showModal()
}

function onsubmit(event: SubmitEvent) {
	event.preventDefault()
	if (overLimit) return
	onsave(toLogRecord($state.snapshot(form), game))
	dialog.close()
}

function remove() {
	if (!confirmingDelete) {
		confirmingDelete = true
		return
	}
	ondelete?.()
	dialog.close()
}

/**
 * Enter in a text field would submit the whole log; only the Save button (or
 * ⌘/Ctrl+Enter from anywhere) does.
 */
function onkeydown(event: KeyboardEvent) {
	if (event.key !== 'Enter') return
	if (event.metaKey || event.ctrlKey) {
		event.preventDefault()
		formEl?.requestSubmit()
	} else if (event.target instanceof HTMLInputElement) {
		event.preventDefault()
	}
}

/** Close when the backdrop (the dialog element itself) is clicked. */
function onclick(event: MouseEvent) {
	if (event.target === dialog) dialog.close()
}
</script>

<dialog bind:this={dialog} aria-labelledby={titleId} {onclick} {onkeydown}>
	<form bind:this={formEl} class="log-form" novalidate {onsubmit}>
		{#key session}
			<header class="dialog-header">
				<div class="game">
					<div class="thumb"><CoverImage image={game.coverUrl} title={game.title} /></div>
					<div class="game-text">
						<h2 class="label" id={titleId}>{editing ? 'Edit log' : 'Log a play'}</h2>
						<p class="game-title">
							{game.title}
							{#if game.year}<span class="year">{game.year}</span>{/if}
						</p>
					</div>
				</div>
				<button class="close" type="button" aria-label="Close" onclick={() => dialog.close()}>
					<Icon name="x" width="24" height="24" />
				</button>
			</header>

			<div class="dialog-body">
				<div class="field-grid">
					<TextInput
						type="date"
						label="Date played"
						max={today()}
						reserveMessageSpace={false}
						bind:value={form.datePlayed}
					/>
					<PlayStateMenu
						bind:started={form.startedPlaying}
						bind:finished={form.finishedPlaying}
						startedLabel={started.label}
						startedHint={started.hint}
					/>
				</div>

				<div class="field-grid">
					{#if platformOptions.length}
						<SelectField label="Platform" reserveMessageSpace={false} bind:value={form.platform}>
							<option value="">Not specified</option>
							{#each platformOptions as platform (platform)}
								<option value={platform}>{platform}</option>
							{/each}
						</SelectField>
					{/if}
					{#if editionOptions.length || dlcOptions.length}
						<EditionMenu
							editionGroups={editionOptions}
							dlcGroups={dlcOptions}
							bind:edition={form.edition}
							bind:dlc={form.dlc}
						/>
					{/if}
				</div>

				<RichTextEditor
					label="Review"
					placeholder="What did you think?"
					maxGraphemes={REVIEW_MAX_GRAPHEMES}
					spoilers
					bind:value={form.review}
				/>
				<label class={['check', { muted: !hasReviewText }]}>
					<input type="checkbox" disabled={!hasReviewText} bind:checked={form.containsSpoilers} />
					<span class="check-text">
						<span>Hide the whole review as a spoiler</span>
						<span class="hint">Or mark parts with the spoiler button</span>
					</span>
				</label>

				<div class="verdict">
					<div class="verdict-field">
						<FieldLabel label="Rating" />
						<div class="verdict-control">
							<StarRating bind:value={form.rating} label="Rating" />
						</div>
					</div>
					<div class="verdict-field">
						<FieldLabel label="Like" />
						<div class="verdict-control">
							<LikeButton bind:liked={form.liked} />
						</div>
					</div>
				</div>

				<Divider />

				<ReplygateMenu bind:allow={form.allow} />
			</div>

			<footer class="dialog-footer">
				<p class="preview copy sm secondary" aria-live="polite">
					<span class="preview-tag">In your feed</span>
					<span>{actor} <strong>{verb}</strong> {game.title}</span>
				</p>
				<div class="footer-actions">
					{#if editing && ondelete}
						<button
							class={['outline-button delete', { confirming: confirmingDelete }]}
							type="button"
							onclick={remove}
							onblur={() => (confirmingDelete = false)}
						>
							<span>{confirmingDelete ? 'Really delete?' : 'Delete'}</span>
						</button>
					{/if}
					<button class="button small" type="button" onclick={() => dialog.close()}>
						<span>Cancel</span>
					</button>
					<button class="button small primary" type="submit" disabled={overLimit}>
						<span>{editing ? 'Save' : 'Log it'}</span>
					</button>
				</div>
			</footer>
		{/key}
	</form>
</dialog>

<style>
@starting-style {
	dialog[open] {
		opacity: 0;
	}
}

@media (prefers-reduced-motion: no-preference) {
	@starting-style {
		dialog[open] {
			translate: var(--hidden-translate);
		}
	}

	dialog:not([open]) {
		translate: var(--hidden-translate);
	}
}

@starting-style {
	dialog[open]::backdrop {
		opacity: 0;
	}
}

/* A side sheet on wide screens, a bottom sheet on narrow ones. */
dialog {
	--hidden-translate: 100% 0;

	inline-size: min(32rem, 100vi);
	max-inline-size: none;
	block-size: 100dvb;
	max-block-size: 100dvb;
	padding: 0;
	margin: 0 0 0 auto;
	overflow: hidden;
	color: var(--color-text);
	background: var(--color-grey-800);
	border: 1px solid var(--color-border);
	border-block: none;
	border-inline-end: none;
	border-radius: 8px 0 0 8px;
	opacity: 1;
	transition:
		opacity 300ms cubic-bezier(0.32, 0.72, 0, 1),
		translate 300ms cubic-bezier(0.32, 0.72, 0, 1),
		display 300ms allow-discrete,
		overlay 300ms allow-discrete;

	@supports (corner-shape: squircle) {
		border-radius: 16px 0 0 16px;
		corner-shape: var(--corner-shape);
	}

	@media (width < 40rem) {
		--hidden-translate: 0 100%;

		inline-size: 100vi;
		block-size: auto;
		max-block-size: 92dvb;
		margin: auto 0 0;
		border-block-start: 1px solid var(--color-border);
		border-inline: none;
		border-radius: 8px 8px 0 0;

		@supports (corner-shape: squircle) {
			border-radius: 16px 16px 0 0;
		}
	}
}

dialog:not([open]) {
	opacity: 0;
}

dialog::backdrop {
	background: rgb(0 0 0 / 40%);
	opacity: 0;
	transition:
		opacity 200ms ease-out,
		display 200ms allow-discrete,
		overlay 200ms allow-discrete;
}

dialog[open]::backdrop {
	opacity: 1;
}

.log-form {
	display: flex;
	flex-direction: column;
	block-size: 100%;
	max-block-size: inherit;
}

.dialog-header {
	display: flex;
	gap: var(--space-2);
	align-items: center;
	justify-content: space-between;
	padding: 16px 16px 12px;
}

.game {
	display: flex;
	gap: 12px;
	align-items: center;
	min-inline-size: 0;
}

.thumb {
	flex: none;
	inline-size: 40px;
}

.game-text {
	display: grid;
	gap: 8px;
	min-inline-size: 0;
}

.game-title {
	overflow: hidden;
	text-overflow: ellipsis;
	font-size: 1.0625rem;
	font-weight: 600;
	color: var(--color-grey-050);
	white-space: nowrap;
	text-box: trim-both cap alphabetic;
}

.year {
	margin-inline-start: 4px;
	font-weight: 400;
	color: var(--color-muted);
}

.close {
	display: flex;
	align-self: flex-start;
	padding: 4px;
	color: var(--color-grey-300);
	background: transparent;
	border: none;
	border-radius: 4px;

	@supports (corner-shape: squircle) {
		border-radius: 8px;
		corner-shape: var(--corner-shape);
	}

	&:hover {
		color: var(--color-grey-050);
	}

	&:focus-visible {
		outline: 2px solid var(--color-accent);
	}
}

.dialog-body {
	display: grid;
	flex: 1;
	gap: 20px;
	align-content: start;
	min-block-size: 0;
	padding: 4px 16px 16px;
	overflow-block: auto;
	overscroll-behavior: contain;
}

.dialog-footer {
	display: flex;
	flex-wrap: wrap;
	gap: 12px;
	align-items: center;
	justify-content: space-between;
	padding: 12px 16px;
	border-block-start: 1px solid var(--color-grey-700);
}

.preview {
	display: grid;
	flex: 1 1 14rem;
	gap: 8px;
	min-inline-size: 0;

	strong {
		font-weight: 600;
		color: var(--color-grey-100);
	}
}

.preview-tag {
	font-size: 0.75rem;
	color: var(--color-grey-500);
	text-transform: uppercase;
	letter-spacing: 0.06em;
}

.footer-actions {
	display: flex;
	gap: 8px;
	align-items: center;
	margin-inline-start: auto;

	.button:disabled {
		cursor: default;
		opacity: 0.5;
	}
}

.delete {
	margin-inline-end: 4px;
	font-family: inherit;
	color: var(--color-critical);
	background: transparent;

	&.confirming {
		border-color: var(--color-critical);
	}
}

/* Verdict: stars and like */

.verdict {
	display: flex;
	flex-wrap: wrap;
	gap: 16px 32px;
}

/* Laid out like the other fields: label above, control below. */
.verdict-field {
	display: grid;
	gap: 8px;
	align-content: start;
}

/* Both controls pad their icons by 4px; pull them back so the icons line up with the label. */
.verdict-control {
	display: flex;
	margin-inline: -4px;
}

/* Checkboxes */

.check {
	display: flex;
	gap: 10px;
	align-items: center;
	font-size: 0.9375rem;
	cursor: pointer;

	input {
		flex: none;
		inline-size: 18px;
		block-size: 18px;
		margin: 0;
		accent-color: var(--color-blue-500);
	}

	&:has(:disabled) {
		cursor: default;
	}

	&.muted {
		color: var(--color-grey-400);
	}
}

.check-text {
	display: grid;
	gap: 2px;
}

.hint {
	font-size: 0.8125rem;
	color: var(--color-grey-500);
}

/* Field rows */

.field-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
	gap: 16px;

	/* Inputs and selects have an intrinsic width that would otherwise overflow the tracks. */
	:global(.input-field),
	:global(input),
	:global(select) {
		min-inline-size: 0;
	}
}
</style>
