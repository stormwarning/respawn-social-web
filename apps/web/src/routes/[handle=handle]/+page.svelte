<script lang="ts">
import { enhance } from '$app/forms'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()

// svelte-ignore state_referenced_locally -- intentional seed; resynced by the $effect below
let following = $state(Boolean(data.followUri))
let saving = $state(false)

// Resync when navigating between profiles (the component instance is reused).
$effect(() => {
	following = Boolean(data.followUri)
})

const displayName = $derived(data.profile?.displayName || data.handle)
const playStateLabels: Record<string, string> = {
	played: 'Played',
	completed: 'Completed',
	abandoned: 'Abandoned',
	retired: 'Retired',
	shelved: 'Shelved',
}
</script>

<svelte:head>
	<title>{displayName} · Respawn Social</title>
</svelte:head>

<article>
	<header class="profile-header">
		{#if data.avatarUrl}
			<img class="avatar" src={data.avatarUrl} alt="" />
		{/if}
		<div>
			<h1>{displayName}</h1>
			<p class="sub">
				@{data.handle}
				{#if data.profile?.pronouns}· {data.profile.pronouns}{/if}
			</p>
		</div>
		{#if data.isLoggedIn && !data.isSelf}
			<form
				method="POST"
				action={following ? '?/unfollow' : '?/follow'}
				use:enhance={() => {
					saving = true
					return ({ result, update }) => {
						if (result.type === 'success' && result.data) {
							following = Boolean(result.data.following)
						}
						saving = false
						update({ reset: false })
					}
				}}
			>
				<button type="submit" disabled={saving}>
					{following ? 'Following ✓' : 'Follow'}
				</button>
			</form>
		{:else if data.isSelf}
			<a href="/settings/">Edit profile</a>
		{/if}
	</header>

	{#if data.profile?.description}
		<p>{data.profile.description}</p>
	{/if}

	<p class="sub">
		{data.gameCount} games · {data.logCount} logs · {data.backlogCount} in backlog
		{#if data.profile?.channel}
			· <a href={data.profile.channel} rel="external noopener">channel</a>
		{/if}
		{#if data.profile?.bsky}
			· <a href="https://bsky.app/profile/{data.profile.bsky}" rel="external noopener">Bluesky</a>
		{/if}
	</p>

	{#if data.profile?.faves?.length}
		<h2>Favorites</h2>
		<ul>
			{#each data.profile.faves as fave (fave.game.igdbId)}
				<li><a href="/game/{fave.game.slug}/">{fave.game.title}</a></li>
			{/each}
		</ul>
	{/if}

	<h2>Recent logs</h2>
	{#if data.recentLogs.length === 0}
		<p class="sub">No logs yet.</p>
	{:else}
		<ul>
			{#each data.recentLogs as log (log.uri)}
				<li>
					<a href="/{data.handle}/game/{log.game.slug}/{log.n > 1 ? `${log.n}/` : ''}">
						{log.game.title}
					</a>
					{#if log.finishedPlaying}
						· {playStateLabels[log.finishedPlaying] ?? log.finishedPlaying}
					{/if}
					{#if log.rating}· {log.rating}/10{/if}
					{#if log.liked}· ♥{/if}
					{#if log.hasReview}· reviewed{/if}
				</li>
			{/each}
		</ul>
	{/if}

	{#if data.lists.length}
		<h2>Lists</h2>
		<ul>
			{#each data.lists as list (list.slug)}
				<li>
					<a href="/{data.handle}/list/{list.slug}/">{list.name}</a>
					<span class="sub">({list.itemCount})</span>
				</li>
			{/each}
		</ul>
	{/if}
</article>

<style>
.profile-header {
	display: flex;
	align-items: center;
	gap: var(--space-3);
}

.avatar {
	width: 4rem;
	height: 4rem;
	border-radius: 50%;
	object-fit: cover;
	border: 1px solid var(--color-border);
}

.sub {
	color: var(--color-muted);
	font-size: var(--text-sm);
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
</style>
