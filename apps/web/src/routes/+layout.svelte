<script lang="ts">
import '../app.css'

import type { LayoutData } from './$types'
import SiteHeader from './site-header.svelte'
import SearchDialog from '$lib/components/search-dialog.svelte'

let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props()

let searchDialog: ReturnType<typeof SearchDialog> | undefined
</script>

<SiteHeader {data} onsearch={() => searchDialog?.open()} />
<SearchDialog {data} bind:this={searchDialog} />

<main>
	{@render children()}
</main>

<style>
main {
	max-width: 48rem;
	margin: 0 auto;
	padding: var(--space-4);
}
</style>
