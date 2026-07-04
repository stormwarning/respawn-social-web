<script lang="ts">
import { enhance } from '$app/forms'
import type { ActionData, PageData } from './$types'

let { data, form }: { data: PageData; form: ActionData } = $props()
// svelte-ignore state_referenced_locally -- intentional seed; resynced by the $effect below
let played = $state(data.played)
let saving = $state(false)
let showLogForm = $state(false)

// Resync when navigating between games (the component instance is reused).
$effect(() => {
	played = data.played
	showLogForm = false
})
</script>

<svelte:head>
	<title>{data.game.name} · Respawn Social</title>
</svelte:head>

<article>
	<h1>{data.game.name}</h1>
	<img src={data.game.cover?.url} alt="" />
	{#if data.isLoggedIn}
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
			<input type="hidden" name="igdbId" value={data.game.id} />
			<input type="hidden" name="coverUrl" value={data.game.cover?.url ?? ''} />
			<button type="submit" disabled={saving}>
				{played ? 'Played ✓ (click to remove)' : 'Mark as played'}
			</button>
		</form>

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
	{/if}
	{#if data.game.summary}
		<p>{data.game.summary}</p>
	{/if}
	<p>Website: {data.site}</p>
	<p>IGDB: {data.game.url}</p>
	<p>Where to play:</p>
	<ul>
		{#each data.game.external_games as item}<li>{item.url}</li>{/each}
	</ul>
	<p>Developer: {data.game.developer}</p>
	<p>Publisher: {data.game.publisher}</p>
	<p>Platforms:</p>
	<ul>
		{#each data.game.platforms as platform}<li>{platform.name}</li>{/each}
	</ul>
	<p>Genres:</p>
	<ul>
		{#each data.game.genres as genre}<li>{genre.name}</li>{/each}
	</ul>
</article>

<style>
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
</style>
