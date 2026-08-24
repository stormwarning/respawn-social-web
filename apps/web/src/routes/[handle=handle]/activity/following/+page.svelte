<script lang="ts">
import ActivityFeed from '$lib/components/activity-feed.svelte'
import ProfileNav from '$lib/components/profile-nav.svelte'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()
</script>

<svelte:head>
	<title>{data.handle}’s following feed — Respawn</title>
</svelte:head>

<ProfileNav handle={data.handle} displayName={data.displayName} avatarUrl={data.avatarUrl} />

<ActivityFeed
	feed={data.feed}
	appviewConfigured={data.appviewConfigured}
	feedError={data.feedError}
	emptyText="No activity from the accounts they follow yet."
/>
