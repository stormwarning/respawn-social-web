<script lang="ts">
import { enhance } from '$app/forms'
import type { ActionData, PageData } from './$types'

let { data, form }: { data: PageData; form: ActionData } = $props()

// svelte-ignore state_referenced_locally -- intentional seed; resynced by the $effect below
let liked = $state(data.liked)
let saving = $state(false)
let revealSpoilers = $state(false)

// Resync when navigating between logs (the component instance is reused).
$effect(() => {
	liked = data.liked
	revealSpoilers = false
})

const playStateLabels: Record<string, string> = {
	played: 'Played',
	completed: 'Completed',
	abandoned: 'Abandoned',
	retired: 'Retired',
	shelved: 'Shelved',
}

const reviewText = $derived(
	revealSpoilers && data.log.review?.textWithSpoilers
		? data.log.review.textWithSpoilers
		: (data.log.review?.text ?? ''),
)
const hiddenBySpoilers = $derived(Boolean(data.log.review?.containsSpoilers) && !revealSpoilers)
</script>

<svelte:head>
	<title>{data.log.game.title} · log by @{data.handle} · Respawn Social</title>
</svelte:head>

<article>
	<header>
		<h1><a href="/game/{data.log.game.slug}/">{data.log.game.title}</a></h1>
		<p class="sub">
			Logged by <a href="/{data.handle}/">@{data.handle}</a>
			{#if data.total > 1}· log {data.n} of {data.total}{/if}
		</p>
	</header>

	<ul class="facts">
		{#if data.log.platform}<li>Platform: {data.log.platform}</li>{/if}
		{#if data.log.edition}<li>Edition: {data.log.edition}</li>{/if}
		{#if data.log.dlc?.length}<li>DLC: {data.log.dlc.join(', ')}</li>{/if}
		{#if data.log.datePlayed}
			<li>Played on {new Date(data.log.datePlayed).toLocaleDateString()}</li>
		{/if}
		{#if data.log.finishedPlaying}
			<li>{playStateLabels[data.log.finishedPlaying] ?? data.log.finishedPlaying}</li>
		{/if}
		{#if data.log.rating}<li>Rated {data.log.rating}/10</li>{/if}
		{#if data.log.liked}<li>Liked ♥</li>{/if}
	</ul>

	{#if data.log.review?.text}
		<section class="review">
			<h2>Review</h2>
			{#if hiddenBySpoilers}
				<p class="sub">This review contains spoilers.</p>
				<button type="button" onclick={() => (revealSpoilers = true)}>Show review</button>
			{:else}
				<p class="review-text">{reviewText}</p>
				{#if !revealSpoilers && data.log.review.textWithSpoilers}
					<button type="button" onclick={() => (revealSpoilers = true)}>Reveal spoilers</button>
				{/if}
			{/if}
		</section>
	{/if}

	{#if data.isLoggedIn && !data.likesDisabled}
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
			<button type="submit" disabled={saving}>{liked ? 'Liked ♥' : 'Like'}</button>
		</form>
	{/if}

	<section class="comments">
		<h2>Comments</h2>
		<p class="sub">Comment counts and threads arrive with the following feed.</p>
		{#if data.commentsClosed}
			<p class="sub">The author has closed comments on this log.</p>
		{:else if data.isLoggedIn}
			<form method="POST" action="?/comment" use:enhance>
				<textarea name="text" rows="3" maxlength="3000" placeholder="Add a comment"></textarea>
				{#if form?.error}<p class="error">{form.error}</p>{/if}
				{#if form?.commented}<p class="success">Comment posted.</p>{/if}
				<button type="submit">Comment</button>
			</form>
		{:else}
			<p class="sub"><a href="/login/">Log in</a> to comment.</p>
		{/if}
	</section>
</article>

<style>
.sub {
	color: var(--color-muted);
	font-size: var(--text-sm);
}

.facts {
	list-style: none;
	padding: 0;
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-2) var(--space-3);
	color: var(--color-muted);
	font-size: var(--text-sm);
}

.review-text {
	white-space: pre-wrap;
}

textarea {
	width: 100%;
	padding: var(--space-2) var(--space-3);
	border: 1px solid var(--color-border);
	border-radius: var(--radius);
	background: var(--color-surface);
	color: var(--color-text);
	font: inherit;
}

button {
	padding: var(--space-1) var(--space-3);
	border: 1px solid var(--color-border);
	border-radius: var(--radius);
	background: var(--color-accent);
	color: #07101f;
	font-weight: 600;
	cursor: pointer;
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
