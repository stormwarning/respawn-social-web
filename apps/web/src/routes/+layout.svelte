<script lang="ts">
import '../app.css'

import type { LayoutData } from './$types'
import SiteHeader from './site-header.svelte'
import SearchDialog from '$lib/components/search-dialog.svelte'

let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props()

let searchDialog: ReturnType<typeof SearchDialog> | undefined
</script>

<svelte:head>
	<meta name="description" content="Track, save, and share what you’re playing" />
	<meta property="og:image" content="https://respawn.social/og-image.png" />
</svelte:head>

<SiteHeader {data} onsearch={() => searchDialog?.open()} />
<SearchDialog {data} bind:this={searchDialog} />

<main>
	{@render children()}
</main>

<style>
main {
	max-width: 60rem;
	margin: 0 auto;
	padding: 16px;
	container-type: inline-size;
}
</style>
