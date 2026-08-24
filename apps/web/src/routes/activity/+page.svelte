<script lang="ts">
import ActivityFeed from '$lib/components/activity-feed.svelte'
import ProfileNav from '$lib/components/profile-nav.svelte'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()
</script>

<svelte:head>
	<title>Activity — Respawn</title>
</svelte:head>

<article class="page">
	{#if data.user}
		<ProfileNav
			handle={data.user.handle ?? data.user.did}
			displayName={data.user.displayName}
			avatarUrl={data.user.avatarUrl}
			isSelf
		/>
	{/if}

	<ActivityFeed
		feed={data.feed}
		appviewConfigured={data.appviewConfigured}
		feedError={data.feedError}
		emptyText="Nothing here yet — follow people from their profile pages and their activity will show up."
	/>
</article>
