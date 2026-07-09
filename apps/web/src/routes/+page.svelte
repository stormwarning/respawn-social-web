<script lang="ts">
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()

const playStateLabels: Record<string, string> = {
	played: 'played',
	completed: 'completed',
	abandoned: 'abandoned',
	retired: 'retired',
	shelved: 'shelved',
}

function authorPath(author: { handle: string | null; did: string }): string {
	return `/${author.handle ?? author.did}/`
}
</script>

<svelte:head>
	<title>Respawn Social</title>
</svelte:head>

{#if data.loggedIn}
	<h1>Your feed</h1>
	{#if !data.appviewConfigured}
		<p class="sub">The following feed isn't configured yet (APPVIEW_URL).</p>
	{:else if data.feedError}
		<p class="sub">Couldn't load your feed. Try again in a moment.</p>
	{:else if data.timeline && data.timeline.feed.length === 0}
		<p class="sub">
			Nothing here yet — follow people from their profile pages and their logs will show up.
		</p>
	{:else if data.timeline}
		<ol class="feed">
			{#each data.timeline.feed as item (item.uri)}
				{@const author = item.author}
				{@const rec = item.record}
				<li class="feed-item">
					<p>
						<a href={authorPath(author)}>{author.displayName ?? author.handle ?? author.did}</a>
						logged
						<a href="/game/{rec.game.slug}/">{rec.game.title}</a>
						{#if rec.finishedPlaying}as {playStateLabels[rec.finishedPlaying] ??
								rec.finishedPlaying}{/if}
						{#if rec.rating}· {rec.rating}/10{/if}
						{#if rec.liked}· ♥{/if}
					</p>
					{#if rec.review?.text && !rec.review.containsSpoilers}
						<blockquote>{rec.review.text}</blockquote>
					{:else if rec.review?.containsSpoilers}
						<p class="sub">Review hidden (spoilers).</p>
					{/if}
					<p class="sub">
						{new Date(item.createdAt).toLocaleDateString()}
						· {item.likeCount} likes · {item.commentCount} comments
						{#if item.viewer?.like}· liked by you{/if}
					</p>
				</li>
			{/each}
		</ol>
		{#if data.timeline.cursor}
			<a href="/?cursor={encodeURIComponent(data.timeline.cursor)}">Older</a>
		{/if}
	{/if}
{:else}
	<h1>Respawn Social</h1>
	<p>A game-focused social app on the AT Protocol.</p>
	<p><a href="/login">Log in with Bluesky</a> to get started.</p>
{/if}

<style>
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

blockquote {
	margin: var(--space-2) 0;
	padding-left: var(--space-3);
	border-left: 2px solid var(--color-border);
	color: var(--color-muted);
	white-space: pre-wrap;
}
</style>
