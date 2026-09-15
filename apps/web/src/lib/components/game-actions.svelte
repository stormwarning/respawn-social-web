<script lang="ts">
import { tick } from 'svelte'
import { applyAction, enhance } from '$app/forms'
import type { ActionResult } from '@sveltejs/kit'
import type { PlayedState } from '$lib/atproto/game'
import { viewerState } from '$lib/viewer-state.svelte'
import IconBookmarksDuotone from './icons/icon-bookmarks-duotone.svelte'
import IconBookmarksSolid from './icons/icon-bookmarks-solid.svelte'
import IconChevronUpDown from './icons/icon-chevron-up-down.svelte'
import IconControllerDuotone from './icons/icon-controller-duotone.svelte'
import IconControllerSolid from './icons/icon-controller-solid.svelte'
import IconHeartSolid from './icons/icon-heart-solid.svelte'
import StarRating from './star-rating.svelte'

let {
	isLoggedIn,
	igdbId,
	slug,
	title,
	coverUrl = '',
	releaseDate = '',
}: {
	isLoggedIn: boolean
	igdbId: number
	slug: string
	title: string
	coverUrl?: string
	releaseDate?: string
} = $props()

const PLAYED_OPTIONS: Array<{ value: PlayedState; label: string; hint: string }> = [
	{ value: 'played', label: 'Played', hint: 'Nothing specific' },
	{ value: 'completed', label: 'Completed', hint: 'Achieved your objective' },
	{ value: 'retired', label: 'Retired', hint: 'Finished a game without an ending' },
	{ value: 'shelved', label: 'Shelved', hint: 'Unfinished, may return to' },
	{ value: 'abandoned', label: 'Abandoned', hint: 'Unfinished, staying that way' },
]

// The viewer's own state lives in the store, not in the page payload, so it is
// read straight from there and every optimistic flip below writes back to it.
let gameState = $derived(viewerState.game(igdbId))
let inBacklog = $derived(viewerState.inBacklog(igdbId))
/**
 * Until the store has answered, an untouched game and an unknown one look the
 * same. Acting on that would post a guess — a backlog click would send the
 * wrong `inBacklog` — so the controls stay inert until it has.
 */
let ready = $derived(viewerState.status === 'ready')
/** StarRating writes the store before the form submits, so rollback reads this. */
let prevRating = 0
let savingPlayState = $state(false)
let savingBacklog = $state(false)
let savingRating = $state(false)
let savingLike = $state(false)
let error = $state<string | null>(null)
let ratingForm = $state<HTMLFormElement>()
let playStateMenu = $state<HTMLDivElement>()
let playStateTrigger = $state<HTMLButtonElement>()
let playStateMenuOpen = $state(false)

/** False is the untouched "Played" button; true swaps it for the menu trigger. */
let hasPlayState = $derived(gameState.playing || gameState.played !== null)
/** `playing` is independent of the played states, but the trigger has room for one label. */
let playStateLabel = $derived(
	gameState.playing
		? 'Playing'
		: (PLAYED_OPTIONS.find((option) => option.value === gameState.played)?.label ?? 'Played'),
)
/** A store that never loaded is worth saying out loud; an action error wins. */
let errorMessage = $derived(
	error ?? (viewerState.status === 'error' ? "Couldn't load your game state." : null),
)

const uid = $props.id()
const playStateMenuId = `${uid}-play-state`

/**
 * Anything but a success left the server state alone, so the caller rolls its
 * optimistic change back. A redirect means the session is gone: follow it.
 */
function handleFailure(result: ActionResult) {
	if (result.type === 'redirect') {
		applyAction(result)
		return
	}
	const message = result.type === 'failure' ? (result.data?.error as string | undefined) : undefined
	error = message ?? 'Could not update. Try again.'
}

// Wait for the hidden input to pick up the new value before submitting.
async function submitRating() {
	await tick()
	ratingForm?.requestSubmit()
}

function closePlayStateMenu() {
	if (playStateMenu?.matches(':popover-open')) playStateMenu.hidePopover()
}

function menuItems() {
	return Array.from(playStateMenu?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]') ?? [])
}

/**
 * The menu lives in the top layer, so it is anchored to its trigger with CSS
 * anchor positioning where supported and measured by hand elsewhere.
 */
function onPlayStateMenuToggle(event: ToggleEvent) {
	playStateMenuOpen = event.newState === 'open'
	if (!playStateMenuOpen || !playStateMenu) return

	if (!CSS.supports('position-anchor', '--play-state') && playStateTrigger) {
		const rect = playStateTrigger.getBoundingClientRect()
		playStateMenu.style.insetBlockStart = `${rect.bottom + 4}px`
		playStateMenu.style.insetInlineStart = `${rect.left}px`
	}

	const items = menuItems()
	;(items.find((item) => item.getAttribute('aria-checked') === 'true') ?? items[0])?.focus()
}

function onPlayStateMenuKeydown(event: KeyboardEvent) {
	const items = menuItems()
	const index = items.indexOf(document.activeElement as HTMLButtonElement)
	let next: number | undefined

	switch (event.key) {
		case 'ArrowDown':
			next = (index + 1) % items.length
			break
		case 'ArrowUp':
			next = (index - 1 + items.length) % items.length
			break
		case 'Home':
			next = 0
			break
		case 'End':
			next = items.length - 1
			break
		case 'Tab':
			closePlayStateMenu()
			return
		default:
			return
	}

	event.preventDefault()
	items[next]?.focus()
}
</script>

<section class="actions">
	{#if !isLoggedIn}
		<a class="action-button" href="/login/">
			<span>Sign in to track this game</span>
		</a>
	{:else}
		<div class="actions-primary" aria-busy={ready ? undefined : 'true'}>
			<form
				method="POST"
				action="?/playState"
				use:enhance={({ formData, submitter }) => {
					error = null
					closePlayStateMenu()
					const next =
						submitter instanceof HTMLButtonElement
							? submitter.value
							: String(formData.get('state') ?? '')
					const prev = { played: gameState.played, playing: gameState.playing }
					// `playing` and `played` are independent; mirror the action's rules.
					if (next === 'playing') viewerState.setGame(igdbId, { playing: true })
					else if (next === 'stop-playing') viewerState.setGame(igdbId, { playing: false })
					else if (next === 'unplayed') viewerState.setGame(igdbId, { played: null })
					else viewerState.setGame(igdbId, { played: next as PlayedState })
					savingPlayState = true
					return ({ result }) => {
						savingPlayState = false
						if (result.type === 'success' && result.data) {
							viewerState.setGame(igdbId, {
								played: (result.data.played as PlayedState | null) ?? null,
								playing: Boolean(result.data.playing),
							})
							return
						}
						viewerState.setGame(igdbId, prev)
						handleFailure(result)
					}
				}}
			>
				<input type="hidden" name="igdbId" value={igdbId} />
				<input type="hidden" name="slug" value={slug} />
				<input type="hidden" name="title" value={title} />
				<input type="hidden" name="coverUrl" value={coverUrl} />
				<input type="hidden" name="releaseDate" value={releaseDate} />
				{#if !hasPlayState}
					<button
						class="action-button has-played"
						type="submit"
						name="state"
						value="played"
						disabled={!ready || savingPlayState}
						aria-pressed="false"
					>
						<IconControllerDuotone />
						<span>Played</span>
					</button>
				{:else}
					<button
						bind:this={playStateTrigger}
						class="action-button has-played play-state-trigger"
						type="button"
						disabled={!ready || savingPlayState}
						popovertarget={playStateMenuId}
						aria-pressed="true"
						aria-haspopup="menu"
						aria-expanded={playStateMenuOpen}
						aria-controls={playStateMenuId}
					>
						<IconControllerSolid />
						<span>{playStateLabel}</span>
						<span class="chevron" aria-hidden="true"><IconChevronUpDown /></span>
					</button>
					<div
						bind:this={playStateMenu}
						id={playStateMenuId}
						class="menu"
						popover="auto"
						role="menu"
						tabindex="-1"
						aria-label="Play state"
						ontoggle={onPlayStateMenuToggle}
						onkeydown={onPlayStateMenuKeydown}
					>
						<button
							class="menu-item"
							type="submit"
							name="state"
							value={gameState.playing ? 'stop-playing' : 'playing'}
							role="menuitemcheckbox"
							aria-checked={gameState.playing}
							tabindex="-1"
						>
							<span class="menu-item-label">Playing</span>
							<span class="menu-item-hint">Currently playing</span>
						</button>
						<hr class="menu-divider" />
						{#each PLAYED_OPTIONS as option (option.value)}
							<button
								class="menu-item"
								type="submit"
								name="state"
								value={option.value}
								role="menuitemradio"
								aria-checked={gameState.played === option.value}
								tabindex="-1"
							>
								<span class="menu-item-label">{option.label}</span>
								<span class="menu-item-hint">{option.hint}</span>
							</button>
						{/each}
						{#if gameState.played !== null}
							<hr class="menu-divider" />
							<button
								class="menu-item"
								type="submit"
								name="state"
								value="unplayed"
								role="menuitem"
								tabindex="-1"
							>
								<span class="menu-item-label">Mark as unplayed</span>
							</button>
						{/if}
					</div>
				{/if}
			</form>

			<form
				method="POST"
				action="?/backlog"
				use:enhance={() => {
					error = null
					const prev = inBacklog
					viewerState.setBacklog(igdbId, !prev)
					savingBacklog = true
					return ({ result }) => {
						savingBacklog = false
						if (result.type === 'success' && result.data) {
							viewerState.setBacklog(igdbId, Boolean(result.data.inBacklog))
							return
						}
						viewerState.setBacklog(igdbId, prev)
						handleFailure(result)
					}
				}}
			>
				<input type="hidden" name="igdbId" value={igdbId} />
				<input type="hidden" name="slug" value={slug} />
				<input type="hidden" name="title" value={title} />
				<input type="hidden" name="coverUrl" value={coverUrl} />
				<input type="hidden" name="releaseDate" value={releaseDate} />
				<input type="hidden" name="inBacklog" value={inBacklog} />
				<button
					class="action-button is-backlog"
					type="submit"
					disabled={!ready || savingBacklog}
					title={inBacklog ? 'Remove from backlog' : 'Add to backlog'}
					aria-label={inBacklog ? 'Remove from backlog' : 'Add to backlog'}
					aria-pressed={inBacklog ? 'true' : 'false'}
				>
					{#if inBacklog}
						<IconBookmarksSolid />
					{:else}
						<IconBookmarksDuotone />
					{/if}
				</button>
			</form>
		</div>
		<div class="actions-rating" aria-busy={ready ? undefined : 'true'}>
			<form
				bind:this={ratingForm}
				method="POST"
				action="?/rate"
				use:enhance={() => {
					error = null
					savingRating = true
					return ({ result }) => {
						savingRating = false
						if (result.type === 'success' && result.data) {
							viewerState.setGame(igdbId, { rating: Number(result.data.rating) })
							return
						}
						viewerState.setGame(igdbId, { rating: prevRating })
						handleFailure(result)
					}
				}}
			>
				<input type="hidden" name="igdbId" value={igdbId} />
				<input type="hidden" name="slug" value={slug} />
				<input type="hidden" name="title" value={title} />
				<input type="hidden" name="coverUrl" value={coverUrl} />
				<input type="hidden" name="rating" value={gameState.rating} />
				<StarRating
					value={gameState.rating}
					disabled={!ready || savingRating}
					label="Your rating"
					onchange={(next) => {
						prevRating = gameState.rating
						viewerState.setGame(igdbId, { rating: next })
						void submitRating()
					}}
				/>
			</form>

			<form
				method="POST"
				action="?/like"
				use:enhance={() => {
					error = null
					const prev = gameState.liked
					viewerState.setGame(igdbId, { liked: !prev })
					savingLike = true
					return ({ result }) => {
						savingLike = false
						if (result.type === 'success' && result.data) {
							viewerState.setGame(igdbId, { liked: Boolean(result.data.liked) })
							return
						}
						viewerState.setGame(igdbId, { liked: prev })
						handleFailure(result)
					}
				}}
			>
				<input type="hidden" name="igdbId" value={igdbId} />
				<input type="hidden" name="slug" value={slug} />
				<input type="hidden" name="title" value={title} />
				<input type="hidden" name="coverUrl" value={coverUrl} />
				<button
					class="like-button"
					type="submit"
					disabled={!ready || savingLike}
					aria-label="Like"
					aria-pressed={gameState.liked ? 'true' : 'false'}
				>
					<IconHeartSolid />
				</button>
			</form>
		</div>
		{#if errorMessage}
			<p class="error" role="status">{errorMessage}</p>
		{/if}
	{/if}
</section>

<!-- TODO: refactor and re-enable the log controls.
<section class="log">
	{#if data.ownLogs.length}
		<h2>Your logs</h2>
		<ul>
			{#each data.ownLogs as log (log.n)}
				<li>
					<a href="/{data.viewerHandle}/game/{data.game.slug}/{log.n > 1 ? `${log.n}/` : ''}">
						Log {log.n} · {new Date(log.createdAt).toLocaleDateString()}
					</a>
					{#if log.rating}· {log.rating}/10{/if}
				</li>
			{/each}
		</ul>
	{/if}

	{#if !showLogForm}
		<button type="button" onclick={() => (showLogForm = true)}>Log a play</button>
	{:else}
		<form
			method="POST"
			action="?/log"
			class="log-form"
			use:enhance={() => {
				saving = true
				return ({ result, update }) => {
					saving = false
					if (result.type === 'success') showLogForm = false
					update()
				}
			}}
		>
			<label for="platform">Platform</label>
			<input id="platform" name="platform" type="text" placeholder="e.g. PC, Switch" />

			<label for="datePlayed">Date played</label>
			<input id="datePlayed" name="datePlayed" type="date" />

			<label for="finishedPlaying">Play state</label>
			<select id="finishedPlaying" name="finishedPlaying">
				<option value="">—</option>
				<option value="played">Played</option>
				<option value="completed">Completed</option>
				<option value="abandoned">Abandoned</option>
				<option value="retired">Retired</option>
				<option value="shelved">Shelved</option>
			</select>

			<label for="rating">Rating (1–10)</label>
			<input id="rating" name="rating" type="number" min="1" max="10" step="1" />

			<label><input name="liked" type="checkbox" /> Liked it</label>

			<label for="review">Review</label>
			<textarea id="review" name="review" rows="4" placeholder="What did you think?"></textarea>
			<label><input name="containsSpoilers" type="checkbox" /> Review contains spoilers</label>

			<label for="allow">Who can comment</label>
			<select id="allow" name="allow">
				<option value="everyone">Everyone</option>
				<option value="following">People I follow</option>
				<option value="followers">My followers</option>
				<option value="nobody">Nobody</option>
			</select>
			<label><input name="disableLikes" type="checkbox" /> Disable likes</label>

			{#if form && 'logError' in form && form.logError}
				<p class="error">{form.logError}</p>
			{/if}

			<button type="submit" disabled={saving}>Save log</button>
			<button type="button" onclick={() => (showLogForm = false)}>Cancel</button>
		</form>
	{/if}
	{#if form && 'logged' in form && form.logged}
		<p class="success">Log saved.</p>
	{/if}
</section>
-->

<style>
.actions {
	display: flex;
	flex-flow: column wrap;
	gap: 8px;
	align-items: center;
	padding: 8px;
	background-color: var(--color-blue-100);
	border-radius: 8px;

	@supports (corner-shape: squircle) {
		border-radius: 16px;
		corner-shape: var(--corner-shape);
	}
}

.actions-primary {
	display: flex;
	gap: 4px;
	align-items: center;
}

.actions-rating {
	display: flex;
	gap: 8px;
	align-items: center;
}

.action-button {
	display: flex;
	gap: 6px;
	align-items: center;
	justify-content: center;
	inline-size: 100%;
	padding: 4px;
	font-family: var(--font-ui);
	font-size: 0.875rem;
	font-weight: 600;
	color: var(--color-grey-700);
	letter-spacing: 0.01em;
	text-decoration: none;
	touch-action: manipulation;
	user-select: none;
	background-color: transparent;
	border: none;
	border-radius: 4px;
	transition: all 100ms ease-out;
	-webkit-tap-highlight-color: transparent;

	@supports (corner-shape: squircle) {
		border-radius: 8px;
		corner-shape: var(--corner-shape);
	}

	:global(> *) {
		text-box: trim-both cap alphabetic;
		translate: 0 -1px;
		transition: all 100ms ease-out;
	}

	:global(> svg) {
		flex: none;
		inline-size: 32px;
		block-size: 32px;
		mix-blend-mode: hard-light;
		fill: currentcolor;
	}

	&:hover {
		background-color: var(--color-blue-200);
	}

	&:focus-visible {
		outline: 2px solid var(--color-blue-500);
		outline-offset: 2px;
	}

	&:active {
		box-shadow:
			inset 0 0 0 100px rgb(0 0 0 / 10%),
			inset 0 1px 0 1px rgb(0 0 0 / 25%),
			inset 0 -1px 0 0 rgb(255 255 255 / 85%);

		:global(> *) {
			translate: 0 1px;
		}
	}

	&:disabled {
		opacity: 0.5;
	}

	&.has-played {
		padding-inline-end: 12px;
	}

	&[aria-pressed='true'] {
		:global(> svg) {
			color: var(--color-blue-600);
			mix-blend-mode: normal;
		}
	}
}

.play-state-trigger {
	padding-inline: 8px;
	anchor-name: --play-state;
}

.chevron {
	display: flex;
	color: var(--color-grey-500);

	:global(> svg) {
		inline-size: 14px;
		block-size: 14px;
	}
}

.menu {
	inset: auto;
	min-inline-size: 240px;
	padding: 4px;
	margin: 0;
	color: var(--color-grey-800);
	background-color: var(--color-grey-050);
	border: none;
	border-radius: 6px;
	box-shadow:
		0 0 0 1px rgb(0 0 0 / 8%),
		0 8px 24px rgb(0 0 0 / 25%);

	@supports (corner-shape: squircle) {
		border-radius: 12px;
		corner-shape: var(--corner-shape);
	}

	@supports (position-anchor: --play-state) {
		margin-block-start: 4px;
		position-area: block-end span-inline-end;
		position-anchor: --play-state;
		position-try-fallbacks: flip-block, flip-inline;
	}
}

.menu-item {
	display: flex;
	flex-direction: column;
	gap: 8px;
	align-items: flex-start;
	inline-size: 100%;
	padding: 12px 8px;
	font: inherit;
	color: inherit;
	text-align: start;
	background-color: transparent;
	border: none;
	border-radius: 4px;

	@supports (corner-shape: squircle) {
		border-radius: 8px;
		corner-shape: var(--corner-shape);
	}

	&:hover,
	&:focus-visible {
		outline: none;
		background-color: var(--color-blue-100);
	}
}

.menu-item-label {
	font-size: 0.875rem;
	font-weight: 600;
	letter-spacing: 0.01em;
	text-box: trim-both cap alphabetic;

	.menu-item[aria-checked='true'] & {
		color: var(--color-blue-600);
	}
}

.menu-item-hint {
	font-size: 0.75rem;
	line-height: 1.2;
	color: var(--color-grey-500);
	letter-spacing: 0.01em;
	text-box: trim-both cap alphabetic;
}

.menu-divider {
	margin: 4px 0;
	border: none;
	border-block-start: 1px solid var(--color-grey-400);
}

.like-button {
	display: flex;
	padding: 4px;
	color: var(--color-grey-600);
	touch-action: manipulation;
	user-select: none;
	background-color: transparent;
	border: none;
	border-radius: 4px;
	transition: all 100ms ease-out;
	-webkit-tap-highlight-color: transparent;

	@supports (corner-shape: squircle) {
		border-radius: 8px;
		corner-shape: var(--corner-shape);
	}

	:global(> svg) {
		display: flex;
		inline-size: 32px;
		block-size: 32px;
		mix-blend-mode: hard-light;
		opacity: 0.5;
	}

	&:hover {
		> :global(svg) {
			scale: 1.2;
		}
	}

	&:focus-visible {
		outline: 2px solid var(--color-blue-500);
		outline-offset: 2px;
	}

	&:active {
		> :global(svg) {
			scale: 0.95;
		}
	}

	&:disabled {
		opacity: 0.5;
	}

	&[aria-pressed='true'] {
		color: var(--color-pink-600);

		:global(> svg) {
			mix-blend-mode: normal;
			opacity: 1;
		}
	}
}

.error {
	font-family: var(--font-ui);
	font-size: 0.75rem;
	color: var(--color-pink-600);
}

/* Re-enable alongside the log controls above.
.log-form {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
	max-width: 30rem;
}

.log-form label {
	font-size: var(--text-sm);
	color: var(--color-muted);
}

.log-form input:not([type='checkbox']),
.log-form select,
.log-form textarea {
	padding: var(--space-2) var(--space-3);
	border: 1px solid var(--color-border);
	border-radius: var(--radius);
	background: var(--color-surface);
	color: var(--color-text);
	font: inherit;
}

.error {
	color: #ff8a8a;
	font-size: var(--text-sm);
}

.success {
	color: var(--color-accent);
	font-size: var(--text-sm);
}
*/
</style>
