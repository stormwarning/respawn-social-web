<script lang="ts">
import ActivityFeed from '$lib/components/activity-feed.svelte'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()
</script>

<svelte:head>
	<title>Your activity — Respawn</title>
</svelte:head>

<h1>Your activity</h1>
<ActivityFeed
	feed={data.feed}
	appviewConfigured={data.appviewConfigured}
	feedError={data.feedError}
	emptyText="Nothing here yet — add a game to your backlog or follow someone to get started."
/>
