<script lang="ts">
import { enhance } from '$app/forms'
import Chip from '$lib/components/chip.svelte'
import CoverImage from '$lib/components/cover-image.svelte'
import type { ActionData, PageData } from './$types'

let { data, form }: { data: PageData; form: ActionData } = $props()
let { game } = $derived(data)

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
	<title>{game.name} 🞍 Respawn</title>
</svelte:head>

<article class="page">
	<header class="game-header">
		<div class="title">
			<h1>{game.name}</h1>
			<div class="title-meta">
				<span>{game.releaseYear}</span>
				{#if game.releaseYear && game.developer}<span role="separator">🞍</span>{/if}
				<span>{game.developer}</span>
			</div>
		</div>
		<CoverImage image={game.cover?.url} />
	</header>

	{#if game.summary}
		<p>{game.summary}</p>
	{/if}

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

	<section class="details">
		<div class="details-block">
			<h4>Publishers</h4>
			<ul class="list">
				{#each game.publisher as publisher}
					<li><Chip>{publisher}</Chip></li>
				{/each}
			</ul>
		</div>
		<div class="details-block">
			<h4>Platforms</h4>
			<ul class="list">
				{#each game.platforms as platform}
					<li><Chip>{platform.name}</Chip></li>
				{/each}
			</ul>
		</div>
		<div class="details-block">
			<h4>Genres</h4>
			<ul class="list">
				{#each game.genres as genre}
					<li><Chip>{genre.name}</Chip></li>
				{/each}
			</ul>
		</div>
		{#if game.url || data.site}
			<div class="details-more">
				<span>More at</span>
				{#if game.url}<a href={game.url} rel="noopener noreferrer">IGDB</a>{/if}
				{#if data.site}<a href={data.site} rel="noopener noreferrer">Official</a>{/if}
			</div>
		{/if}
	</section>
	<!-- <p>Where to play:</p>
	<ul>
		{#each data.game.external_games as item}<li>{item.url}</li>{/each}
	</ul> -->
</article>

<style>
.page {
	display: grid;
	gap: 32px;
	grid-template-columns: 100%;
	padding-top: 16px;

	p {
		font-size: 0.9375rem;
		text-wrap: pretty;
	}
}

.game-header {
	display: grid;
	grid-template-columns: 1fr min(33vw, 230px);
	gap: 16px;
}

.title {
	display: grid;
	align-content: start;
	gap: 24px;

	h1 {
		font-size: 1.375rem;
		font-weight: 600;
		line-height: 1.2;
	}
}

.title-meta {
	display: flex;
	gap: 4px;
	font-size: 0.75rem;
	letter-spacing: 0.02em;
	line-height: 1.2;

	> span:not([role='separator']) {
		color: var(--color-grey-400);
	}

	> span[role='separator'] {
		color: var(--color-grey-500);
	}
}

.details {
	display: grid;
	gap: 16px;
	padding: 16px;
	background-color: var(--color-grey-800);
	border-radius: 8px;
	corner-shape: var(--corner-shape);
}

.details-block {
	display: grid;
	gap: 12px;

	> h4 {
		font-size: 0.875rem;
		font-weight: 400;
		color: var(--color-grey-300);
		letter-spacing: 0.02em;
		text-box: trim-both cap alphabetic;
		text-transform: uppercase;
	}
}

.details-more {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	gap: 8px;
	padding-top: 16px;

	> span {
		font-size: 0.875rem;
		letter-spacing: 0.01em;
		text-box: trim-both cap alphabetic;
	}

	> a {
		padding: 4px;
		font-size: 0.75rem;
		color: var(--color-blue-100);
		letter-spacing: 0.02em;
		text-box: trim-both cap alphabetic;
		text-decoration: none;
		border: 1px solid var(--color-grey-400);
	}
}

.list {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	padding: 0;
	list-style: none;
}

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
