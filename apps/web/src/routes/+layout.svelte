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
	inset-block-start: 0;
	inset-inline-start: 0;
	z-index: 20;
	inline-size: 100%;
	block-size: 3px;
	overflow: hidden;
	pointer-events: none;

	&::after {
		display: block;
		inline-size: 40%;
		block-size: 100%;
		content: '';
		background-color: var(--color-accent);
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
		inline-size: 100%;
		opacity: 0.6;
		animation: none;
	}
}

main {
	--block-spacing: 32px;
	--inline-spacing: 16px;

	position: relative;
	flex: 1 1 100%;
	inline-size: 100%;
	max-inline-size: 60rem;
	padding-block: var(--block-spacing);
	padding-inline: calc(env(safe-area-inset-left) + var(--inline-spacing))
		calc(env(safe-area-inset-right) + var(--inline-spacing));
	margin: 0 auto;
	container-type: inline-size;

	@media (width >= 632px) {
		--block-spacing: 48px;
	}
}

footer {
	--h-padding: 16px;
	--rad-num: 8px;
	--radius: clamp(0px, (100vi - 100%) * 1e5, var(--rad-num));

	display: grid;
	gap: 16px;
	justify-items: center;
	inline-size: 100%;
	max-inline-size: 60rem;
	padding-block: 32px calc(env(safe-area-inset-bottom) + 32px);
	padding-inline: calc(env(safe-area-inset-left) + var(--h-padding))
		calc(env(safe-area-inset-right) + var(--h-padding));
	margin: 0 auto;
	background-color: var(--color-grey-700);
	border-radius: var(--radius) var(--radius) 0 0;

	@supports (corner-shape: squircle) {
		--rad-num: 16px;

		corner-shape: squircle;
	}

	@media (width >= 600px) {
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
			letter-spacing: 0.01em;
			text-decoration: none;
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
		text-align: center;
		letter-spacing: 0.01em;
		text-box: trim-both cap alphabetic;

		a {
			&:hover {
				color: var(--color-grey-200);
			}
		}
	}
}
</style>
