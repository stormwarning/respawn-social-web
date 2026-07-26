<script lang="ts">
import { tick } from 'svelte'
import { enhance } from '$app/forms'
import IconBooksSolid from './icons/icon-books-solid.svelte'
import IconBooks from './icons/icon-books.svelte'
import IconControllerSolid from './icons/icon-controller-solid.svelte'
import IconController from './icons/icon-controller.svelte'
import IconHeartSolid from './icons/icon-heart-solid.svelte'
import IconHeart from './icons/icon-heart.svelte'
import IconPlayCircleSolid from './icons/icon-play-circle-solid.svelte'
import IconPlayCircle from './icons/icon-play-circle.svelte'
import StarRating from './star-rating.svelte'

let {
	isLoggedIn,
	igdbId,
	slug,
	title,
	coverUrl = '',
	played: playedProp,
	playing: playingProp,
	liked: likedProp,
	rating: ratingProp,
	inBacklog: inBacklogProp,
}: {
	isLoggedIn: boolean
	igdbId: number
	slug: string
	title: string
	coverUrl?: string
	played: boolean
	playing: boolean
	liked: boolean
	/** 0–10 in half-star steps; 0 means unrated. */
	rating: number
	inBacklog: boolean
} = $props()

// svelte-ignore state_referenced_locally -- intentional seed; resynced by the $effect below
let played = $state(playedProp)
// svelte-ignore state_referenced_locally -- intentional seed; resynced by the $effect below
let playing = $state(playingProp)
// svelte-ignore state_referenced_locally -- intentional seed; resynced by the $effect below
let liked = $state(likedProp)
// svelte-ignore state_referenced_locally -- intentional seed; resynced by the $effect below
let rating = $state(ratingProp)
// svelte-ignore state_referenced_locally -- intentional seed; resynced by the $effect below
let inBacklog = $state(inBacklogProp)
let saving = $state(false)
let ratingForm = $state<HTMLFormElement>()

// Resync when navigating between games (the component instance is reused).
$effect(() => {
	played = playedProp
	playing = playingProp
	liked = likedProp
	rating = ratingProp
	inBacklog = inBacklogProp
})

// Wait for the hidden input to pick up the new value before submitting.
async function submitRating() {
	await tick()
	ratingForm?.requestSubmit()
}
</script>

<section class="actions">
	{#if !isLoggedIn}
		<a class="action-button" href="/login/">
			<span>Sign in to track this game</span>
		</a>
	{:else}
		<div class="actions-primary">
			<form
				method="POST"
				action="?/playing"
				use:enhance={() => {
					saving = true
					return ({ result, update }) => {
						if (result.type === 'success' && result.data) {
							playing = Boolean(result.data.playing)
						}
						saving = false
						update({ reset: false })
					}
				}}
			>
				<input type="hidden" name="igdbId" value={igdbId} />
				<input type="hidden" name="coverUrl" value={coverUrl} />
				<button
					class="action-button has-icon is-playing"
					type="submit"
					disabled={saving}
					aria-pressed={playing ? 'true' : 'false'}
				>
					<div>
						{#if playing}
							<IconPlayCircleSolid />
							<span>Playing</span>
						{:else}
							<IconPlayCircle />
							<span>Play</span>
						{/if}
					</div>
				</button>
			</form>

			<form
				method="POST"
				action="?/played"
				use:enhance={() => {
					saving = true
					return ({ result, update }) => {
						if (result.type === 'success' && result.data) {
							played = Boolean(result.data.played)
						}
						saving = false
						update({ reset: false })
					}
				}}
			>
				<input type="hidden" name="igdbId" value={igdbId} />
				<input type="hidden" name="coverUrl" value={coverUrl} />
				<button
					class="action-button has-icon has-played"
					type="submit"
					disabled={saving}
					aria-pressed={played ? 'true' : 'false'}
				>
					<div>
						{#if played}
							<IconControllerSolid />
							<span>Played</span>
						{:else}
							<IconController />
							<span>Played</span>
						{/if}
					</div>
				</button>
			</form>

			<form
				method="POST"
				action="?/backlog"
				use:enhance={() => {
					saving = true
					return ({ result, update }) => {
						if (result.type === 'success' && result.data) {
							inBacklog = Boolean(result.data.inBacklog)
						}
						saving = false
						update({ reset: false })
					}
				}}
			>
				<input type="hidden" name="igdbId" value={igdbId} />
				<input type="hidden" name="slug" value={slug} />
				<input type="hidden" name="title" value={title} />
				<input type="hidden" name="coverUrl" value={coverUrl} />
				<input type="hidden" name="inBacklog" value={inBacklog} />
				<button
					class="action-button has-icon is-backlog"
					type="submit"
					disabled={saving}
					aria-pressed={inBacklog ? 'true' : 'false'}
				>
					<div>
						{#if inBacklog}
							<IconBooksSolid />
							<span>Backlog</span>
						{:else}
							<IconBooks />
							<span>Backlog</span>
						{/if}
					</div>
				</button>
			</form>
		</div>
		<div class="actions-rating">
			<form
				bind:this={ratingForm}
				method="POST"
				action="?/rate"
				use:enhance={() => {
					saving = true
					return ({ result, update }) => {
						if (result.type === 'success' && result.data) {
							rating = Number(result.data.rating)
						}
						saving = false
						update({ reset: false })
					}
				}}
			>
				<input type="hidden" name="igdbId" value={igdbId} />
				<input type="hidden" name="coverUrl" value={coverUrl} />
				<input type="hidden" name="rating" value={rating} />
				<StarRating
					bind:value={rating}
					disabled={saving}
					label="Your rating"
					onchange={submitRating}
				/>
			</form>

			<form
				method="POST"
				action="?/like"
				use:enhance={() => {
					saving = true
					return ({ result, update }) => {
						if (result.type === 'success' && result.data) {
							liked = Boolean(result.data.liked)
						}
						saving = false
						update({ reset: false })
					}
				}}
			>
				<input type="hidden" name="igdbId" value={igdbId} />
				<input type="hidden" name="coverUrl" value={coverUrl} />
				<button
					class="like-button"
					type="submit"
					disabled={saving}
					aria-label="Like"
					aria-pressed={liked ? 'true' : 'false'}
				>
					<IconHeartSolid />
				</button>
			</form>
		</div>
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
	flex-direction: column;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
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
	gap: 8px;
}

.actions-rating {
	display: flex;
	align-items: center;
	gap: 8px;
}

.action-button {
	display: flex;
	justify-content: center;
	align-items: center;
	inline-size: 100%;
	padding: 8px;
	font-size: 0.875rem;
	font-weight: 600;
	color: var(--color-grey-700);
	letter-spacing: 0.01em;
	text-decoration: none;
	background-color: transparent;
	border: none;
	border-radius: 4px;
	user-select: none;
	touch-action: manipulation;
	-webkit-tap-highlight-color: transparent;
	transition: all 100ms ease-out;

	@supports (corner-shape: squircle) {
		border-radius: 8px;
		corner-shape: var(--corner-shape);
	}

	> * {
		text-box: trim-both cap alphabetic;
		translate: 0 -1px;
		transition: all 100ms ease-out;
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

		> * {
			translate: 0 1px;
		}
	}

	&.has-icon {
		padding: 4px;
		min-width: 72px;
		aspect-ratio: 1;

		> div {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 2px;

			:global(> svg) {
				width: 40px;
				height: 40px;
				mix-blend-mode: hard-light;
			}

			> span {
				text-box: trim-both cap alphabetic;
			}
		}
	}

	&[aria-pressed='true'] {
		&.is-playing {
			:global(svg) {
				fill: var(--color-green-500);
			}
		}

		&.has-played,
		&.is-backlog {
			:global(svg) {
				fill: var(--color-blue-600);
			}
		}
	}
}

.like-button {
	display: flex;
	padding: 4px;
	color: var(--color-grey-600);
	background-color: transparent;
	border: none;
	border-radius: 4px;
	corner-shape: var(--corner-shape);
	user-select: none;
	touch-action: manipulation;
	-webkit-tap-highlight-color: transparent;
	transition: all 100ms ease-out;

	:global(> svg) {
		display: flex;
		width: 32px;
		height: 32px;
		opacity: 0.5;
		mix-blend-mode: hard-light;
	}

	&:focus-visible {
		outline: 2px solid var(--color-blue-500);
		outline-offset: 2px;
	}

	&:active {
		scale: 0.95;
	}

	&[aria-pressed='true'] {
		color: var(--color-pink-600);

		:global(> svg) {
			opacity: 1;
			mix-blend-mode: normal;
		}
	}
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
