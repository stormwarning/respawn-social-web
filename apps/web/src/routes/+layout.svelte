<script lang="ts">
import '../app.css'

import { navigating } from '$app/state'
import type { LayoutData } from './$types'
import SiteHeader from './site-header.svelte'
import SearchDialog from '$lib/components/search-dialog.svelte'

let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props()

let searchDialog: ReturnType<typeof SearchDialog> | undefined

// Every page load is a server round trip, so a navigation can sit for a second
// or more on the old page with nothing to show for it. The delay keeps the bar
// off screen for navigations that resolve fast enough not to need it.
const PROGRESS_DELAY_MS = 150
let showProgress = $state(false)

$effect(() => {
	if (!navigating.to) {
		showProgress = false
		return
	}
	const timer = setTimeout(() => (showProgress = true), PROGRESS_DELAY_MS)
	return () => clearTimeout(timer)
})
</script>

<svelte:head>
	<meta name="description" content="Track, save, and share what you’re playing" />
	<meta property="og:image" content="https://respawn.social/og-image.png" />
</svelte:head>

{#if showProgress}
	<div class="nav-progress" aria-hidden="true"></div>
{/if}

<SiteHeader {data} onsearch={() => searchDialog?.open()} />
<SearchDialog {data} bind:this={searchDialog} />

<main>
	{@render children()}
</main>

<style>
.nav-progress {
	position: fixed;
	top: 0;
	left: 0;
	z-index: 20;
	width: 100%;
	height: 3px;
	overflow: hidden;
	pointer-events: none;

	&::after {
		display: block;
		width: 40%;
		height: 100%;
		background-color: var(--color-accent);
		content: '';
		animation: nav-progress 1s ease-in-out infinite;
	}
}

@keyframes nav-progress {
	from {
		translate: -100% 0;
	}

	to {
		translate: 350% 0;
	}
}

@media (prefers-reduced-motion: reduce) {
	.nav-progress::after {
		width: 100%;
		animation: none;
		opacity: 0.6;
	}
}

main {
	--block-spacing: 32px;
	--inline-spacing: 16px;

	position: relative;
	max-width: 60rem;
	margin: 0 auto;
	padding: var(--block-spacing) var(--inline-spacing);
	container-type: inline-size;

	@media (min-width: 632px) {
		--block-spacing: 48px;
	}
}
</style>
