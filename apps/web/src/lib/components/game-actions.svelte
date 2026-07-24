<script lang="ts">
import { enhance } from '$app/forms'
import IconBooks from './icons/icon-books.svelte'
import IconController from './icons/icon-controller.svelte'
import IconHeart from './icons/icon-heart.svelte'

let {
	isLoggedIn,
	igdbId,
	slug,
	title,
	coverUrl = '',
	played: playedProp,
	liked: likedProp,
	inBacklog: inBacklogProp,
}: {
	isLoggedIn: boolean
	igdbId: number
	slug: string
	title: string
	coverUrl?: string
	played: boolean
	liked: boolean
	inBacklog: boolean
} = $props()

// svelte-ignore state_referenced_locally -- intentional seed; resynced by the $effect below
let played = $state(playedProp)
// svelte-ignore state_referenced_locally -- intentional seed; resynced by the $effect below
let liked = $state(likedProp)
// svelte-ignore state_referenced_locally -- intentional seed; resynced by the $effect below
let inBacklog = $state(inBacklogProp)
let saving = $state(false)

// Resync when navigating between games (the component instance is reused).
$effect(() => {
	played = playedProp
	liked = likedProp
	inBacklog = inBacklogProp
})
</script>

<section class="actions">
	{#if isLoggedIn}
		<a class="action-button" href="/login/">
			<span>Sign in to track this game</span>
		</a>
	{:else}
		<div class="actions-primary">
			<form
				method="POST"
				action="?/toggle"
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
				<button class="action-button has-icon" type="submit" disabled={saving}>
					<div>
						{#if played}
							✓
						{:else}
							<IconController />
						{/if}
						<span>{played ? 'Played' : 'Play'}</span>
					</div>
				</button>
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
				<button class="action-button has-icon" type="submit" disabled={saving}>
					<div>
						{#if liked}
							♥
						{:else}
							<IconHeart />
						{/if}
						<span>{liked ? 'Liked' : 'Like'}</span>
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
				<button class="action-button has-icon" type="submit" disabled={saving}>
					<div>
						{#if inBacklog}
							✓
						{:else}
							<IconBooks />
						{/if}
						<span>{inBacklog ? 'Backlog' : 'Backlog'}</span>
					</div>
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
	border-radius: 10px;
	corner-shape: var(--corner-shape);

	/*> a {
		padding: 8px;
		font-size: 0.875rem;
		color: var(--color-blue-100);
		letter-spacing: 0.02em;
		text-box: trim-both cap alphabetic;
		text-decoration: none;
		border: 1px solid var(--color-grey-400);
		border-radius: 4px;
		corner-shape: var(--corner-shape);
	}*/
}

.actions-primary {
	display: flex;
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
	color: var(--color-grey-950);
	letter-spacing: 0.01em;
	text-decoration: none;
	background-color: transparent;
	border: none;
	border-radius: 4px;
	corner-shape: var(--corner-shape);
	user-select: none;
	touch-action: manipulation;
	-webkit-tap-highlight-color: transparent;
	transition: all 100ms ease-out;

	> * {
		text-box: trim-both cap alphabetic;
		translate: 0 -1px;
		transition: all 100ms ease-out;
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

		> div {
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 2px;

			:global(> svg) {
				width: 40px;
				height: 40px;
			}

			> span {
				text-box: trim-both cap alphabetic;
			}
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
