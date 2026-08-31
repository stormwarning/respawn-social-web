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

<footer>
	<nav>
		<a
			href="https://userinput.app/s/did:plc:hiabolqnnpdnrb5grmdaaepg/3ms4izobjf222?lang=en"
			target="_blank"
			rel="noopener noreferrer">Feedback</a
		>
		<a href="https://bsky.app/profile/respawn.social" target="_blank" rel="noopener noreferrer"
			>Bluesky</a
		>
	</nav>
	<p>
		© Respawn Social. Made by <a
			href="https://tidaltheory.io/"
			target="_blank"
			rel="noopener noreferrer">Tidal Theory</a
		>. Game data from
		<a href="https://www.igdb.com/" target="_blank" rel="noopener noreferrer">IGDB</a>.
	</p>
</footer>

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
	flex: 1 1 100%;
	width: 100%;
	max-width: 60rem;
	margin: 0 auto;
	padding: var(--block-spacing) var(--inline-spacing);
	container-type: inline-size;

	@media (min-width: 632px) {
		--block-spacing: 48px;
	}
}

footer {
	--h-padding: 16px;
	--rad-num: 8px;
	--radius: clamp(0px, (100vw - 100%) * 1e5, var(--rad-num));

	display: grid;
	justify-items: center;
	gap: 16px;
	width: 100%;
	max-width: 60rem;
	padding: 32px var(--h-padding) calc(env(safe-area-inset-top) + 32px);
	margin: 0 auto;
	background-color: var(--color-grey-700);
	border-radius: var(--radius) var(--radius) 0 0;

	@supports (corner-shape: squircle) {
		--rad-num: 16px;

		corner-shape: squircle;
	}

	@media (min-width: 600px) {
		--h-padding: 32px;

		justify-items: start;
	}

	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;

		a {
			font-size: 0.875rem;
			font-weight: 600;
			color: var(--color-grey-300);
			text-decoration: none;
			letter-spacing: 0.01em;
			text-box: trim-both cap alphabetic;

			&:hover {
				color: var(--color-grey-100);
			}
		}
	}

	p {
		font-size: 0.75rem;
		font-feature-settings: 'ss01';
		color: var(--color-grey-400);
		letter-spacing: 0.01em;
		text-align: center;
		text-box: trim-both cap alphabetic;

		a {
			&:hover {
				color: var(--color-grey-200);
			}
		}
	}
}
</style>
