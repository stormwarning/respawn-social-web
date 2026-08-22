<script lang="ts">
import ActivityFeed from '$lib/components/activity-feed.svelte'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()
</script>

<svelte:head>
	<title>{data.handle}'s activity — Respawn</title>
</svelte:head>

<h1>{data.handle}'s activity</h1>
<ActivityFeed
	feed={data.feed}
	appviewConfigured={data.appviewConfigured}
	feedError={data.feedError}
	emptyText="No activity yet."
/>
