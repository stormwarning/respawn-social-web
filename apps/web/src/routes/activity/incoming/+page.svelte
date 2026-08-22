<script lang="ts">
import ActivityFeed from '$lib/components/activity-feed.svelte'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()
</script>

<svelte:head>
	<title>Incoming activity — Respawn</title>
</svelte:head>

<h1>Incoming</h1>
<ActivityFeed
	feed={data.feed}
	appviewConfigured={data.appviewConfigured}
	feedError={data.feedError}
	emptyText="Nothing about you yet — this fills up when someone follows you."
/>
