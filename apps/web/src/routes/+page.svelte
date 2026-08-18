<script lang="ts">
import type { PageData } from './$types'
import type { FeedActor } from '$lib/server/feed'

let { data }: { data: PageData } = $props()

function actorPath(actor: FeedActor): string {
	return `/${actor.handle ?? actor.did}/`
}

function actorName(actor: FeedActor): string {
	return actor.displayName ?? actor.handle ?? actor.did
}
</script>

<svelte:head>
	<title>Respawn</title>
	<meta property="og:url" content="https://respawn.social" />
</svelte:head>

{#if data.loggedIn}
	<h1>Your feed</h1>
	{#if !data.appviewConfigured}
		<p class="sub">The following feed isn't configured yet (HAPPYVIEW_URL).</p>
	{:else if data.feedError}
		<p class="sub">Couldn't load your feed. Try again in a moment.</p>
	{:else if data.timeline && data.timeline.items.length === 0}
		<p class="sub">
			Nothing here yet — follow people from their profile pages and their activity will show up.
		</p>
	{:else if data.timeline}
		<ol class="feed">
			{#each data.timeline.items as item (item.uri)}
				<li class="feed-item">
					<p>
						<a href={actorPath(item.actor)}>{actorName(item.actor)}</a>
						{#if item.type === 'backlogAdd' && item.game}
							added <a href="/game/{item.game.slug}/">{item.game.title}</a> to their backlog
						{:else if item.type === 'follow' && item.subject}
							followed <a href={actorPath(item.subject)}>{actorName(item.subject)}</a>
						{/if}
					</p>
					{#if item.coverUrl && item.game}
						<img class="cover" src={item.coverUrl} alt="" width="60" height="80" />
					{/if}
					<p class="sub">{new Date(item.createdAt).toLocaleDateString()}</p>
				</li>
			{/each}
		</ol>
		{#if data.timeline.cursor}
			<a href="/?cursor={encodeURIComponent(data.timeline.cursor)}">Older</a>
		{/if}
	{/if}
{:else}
	<article class="page">
		<section class="hero">
			<h1><span>Re</span>spawn</h1>
			<div class="heading subtitle">Track, save, and share what you’re playing</div>
			<div class="signin">
				<p>Press Start to begin</p>
				<a class="button primary" href="/login/"><div>Start</div></a>
			</div>
		</section>
	</article>
{/if}

<style>
.hero {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 64px;
	padding: 64px 0;
	color: var(--color-grey-050);

	> h1 {
		font-size: 2.5rem;
		font-weight: 600;
		text-box: trim-both cap alphabetic;

		> span {
			font-weight: 800;
		}
	}
}

.subtitle {
	padding: 0 16px;
	text-align: center;
}

.signin {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;

	> p {
		color: var(--color-grey-400);
		text-box: trim-both cap alphabetic;
	}
}

.sub {
	color: var(--color-muted);
	font-size: var(--text-sm);
}

.feed {
	list-style: none;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
}

.feed-item {
	border: 1px solid var(--color-border);
	border-radius: var(--radius);
	background: var(--color-surface);
	padding: var(--space-3);
}

.cover {
	margin: var(--space-2) 0;
	border-radius: var(--radius);
	object-fit: cover;
}
</style>
