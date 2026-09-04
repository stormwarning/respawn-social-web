<script lang="ts">
import { enhance } from '$app/forms'
import AvatarImage from '$lib/components/avatar-image.svelte'
import CoverImageStack from '$lib/components/cover-image-stack.svelte'
import CoverList from '$lib/components/cover-list.svelte'
import SectionHeading from '$lib/components/section-heading.svelte'
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
const activityUrl = $derived(data.isSelf ? '/activity/' : `/${data.handle}/activity/`)
const playStateLabels: Record<string, string> = {
	played: 'Played',
	completed: 'Completed',
	abandoned: 'Abandoned',
	retired: 'Retired',
	shelved: 'Shelved',
}
</script>

<svelte:head>
	<title>{displayName}’s profile ▪ Respawn</title>
</svelte:head>

<article class="profile">
	<header class="profile-header">
		<div class="avatar">
			<AvatarImage image={data.avatarUrl} loading="eager" />
		</div>
		<div class="content">
			<h2>{displayName}</h2>

			{#if data.isLoggedIn}
				<div class="profile-actions">
					{#if !data.isSelf}
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
							<button class="button small" type="submit" disabled={saving}>
								<span>{following ? 'Following ✓' : 'Follow'}</span>
							</button>
						</form>
					{:else if data.isSelf}
						<a class="button small" href="/settings/"><span>Edit profile</span></a>
					{/if}
				</div>
			{/if}

			<!-- @todo Only display bio here if it's 140 chars or less. -->
			{#if data.profile?.description}
				<div class="bio">
					<p>{data.profile.description}</p>
				</div>
			{/if}

			<p class="sub">
				<a href="/{data.handle}/games/">{data.gameCount} games</a> · {data.logCount} logs ·
				<a href="/{data.handle}/backlog/">{data.backlogCount} in backlog</a>
				{#if data.profile?.channel}
					· <a href={data.profile.channel} rel="external noopener">channel</a>
				{/if}
				{#if data.profile?.bsky}
					· <a href="https://bsky.app/profile/{data.profile.bsky}" rel="external noopener"
						>Bluesky</a
					>
				{/if}
			</p>
		</div>
	</header>

	<main class="layout">
		<section class="body">
			{#if data.faves.length}
				<div class="faves">
					<SectionHeading>Favourite games</SectionHeading>
					<CoverList items={data.faves} cols={4} />
				</div>
			{/if}
		</section>

		<aside class="sidebar">
			{#if data.backlogCount > 0}
				<section class="backlog">
					<SectionHeading secondary={data.backlogCount}>
						<a href="/{data.handle}/backlog/">Backlog</a>
					</SectionHeading>
					<a href="/{data.handle}/backlog/">
						<CoverImageStack covers={data.backlogCovers} />
					</a>
				</section>
			{/if}

			<section class="backlog">
				<SectionHeading><a href={activityUrl}>Activity</a></SectionHeading>
			</section>

			<!-- <h2>Recent logs</h2>
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
			{/if} -->

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
		</aside>
	</main>
</article>

<style>
.profile {
	display: grid;
	gap: 32px;
	container-type: inline-size;
}

.profile-header {
	display: grid;
	justify-items: center;
	gap: 16px;

	@container (min-width: 600px) {
		grid-template-columns: 112px 1fr;
		justify-items: start;
	}
}

.avatar {
	width: 64px;

	@container (min-width: 600px) {
		width: 100%;
	}
}

.content {
	display: grid;
	justify-items: center;
	gap: 16px;

	h2 {
		text-box: trim-both cap alphabetic;
	}

	@container (min-width: 600px) {
		justify-items: start;
		padding-block: 16px;
	}
}

.profile-actions {
	display: flex;
	align-items: center;
	gap: 8px;
}

.bio {
	max-width: 60ch;
	margin: 0 auto;

	p {
		text-box: trim-both cap alphabetic;
	}
}

.layout {
	display: grid;
	gap: 64px;
	align-items: start;

	@container (min-width: 600px) {
		grid-template-columns: 1fr 256px;
	}
}

.faves {
	display: grid;
	gap: 16px;
}

.sidebar {
	display: grid;
	gap: 24px;
}

.backlog {
	display: grid;
	gap: 16px;
}

.sub {
	color: var(--color-muted);
	font-size: var(--text-sm);
}
</style>
