<script lang="ts">
import type { HydratedFeed, FeedActor } from '$lib/server/feed'

interface Props {
	feed: HydratedFeed | null
	appviewConfigured: boolean
	feedError: boolean
	emptyText: string
}

let { feed, appviewConfigured, feedError, emptyText }: Props = $props()

function actorPath(actor: FeedActor): string {
	return `/${actor.handle ?? actor.did}/`
}

function actorName(actor: FeedActor): string {
	return actor.displayName ?? actor.handle ?? actor.did
}
</script>

{#if !appviewConfigured}
	<p class="sub">Activity isn't configured yet (HAPPYVIEW_URL).</p>
{:else if feedError}
	<p class="sub">Couldn't load this feed. Try again in a moment.</p>
{:else if feed && feed.items.length === 0}
	<p class="sub">{emptyText}</p>
{:else if feed}
	<ol class="feed">
		{#each feed.items as item (item.uri)}
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
	{#if feed.cursor}
		<!-- Query-only href, so paging stays on whichever activity route this is. -->
		<a href="?cursor={encodeURIComponent(feed.cursor)}">Older</a>
	{/if}
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

.cover {
	margin: var(--space-2) 0;
	border-radius: var(--radius);
	object-fit: cover;
}
</style>
