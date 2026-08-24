<script lang="ts">
import type { HydratedFeed, FeedActor } from '$lib/server/feed'
import ActivityBacklog from './activity-backlog.svelte'
import ActivityFollow from './activity-follow.svelte'
import Divider from './divider.svelte'

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

/** Shape the activity components expect, built from the hydrated feed actor. */
function activityActor(actor: FeedActor) {
	const url = actorPath(actor)
	return {
		did: actor.did,
		name: actorName(actor),
		url,
		backlogUrl: `${url}backlog/`,
		pronouns: actor.pronouns,
	}
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
		{#each feed.items as item, index (item.uri)}
			<li class="feed-item">
				{#if item.type === 'backlogAdd' && item.game}
					<ActivityBacklog
						actor={activityActor(item.actor)}
						game={{ slug: item.game.slug, title: item.game.title }}
						createdAt={item.createdAt}
					/>
				{:else if item.type === 'follow' && item.subject}
					<ActivityFollow
						actor={activityActor(item.actor)}
						subject={activityActor(item.subject)}
						createdAt={item.createdAt}
					/>
				{/if}
			</li>
			{#if index < feed.items.length - 1}
				<Divider />
			{/if}
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
</style>
