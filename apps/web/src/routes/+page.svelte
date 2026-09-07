<script lang="ts">
import { page } from '$app/state'
import type { PageData } from './$types'
import Holographic from '$lib/components/holographic.svelte'

let { data }: { data: PageData } = $props()

// `?seed=…` previews the holographic mark with a different seed.
const seed = $derived(page.url.searchParams.get('seed') ?? 'respawn')
</script>

<svelte:head>
	<title>Respawn</title>
	<meta property="og:url" content="https://respawn.social" />
</svelte:head>

{#if data.loggedIn}
	<h1>Recent logs</h1>
	<p class="sub">
		Logs from the people you follow will land here. Until then, <a href="/activity/"
			>your activity feed</a
		> has backlog adds and follows.
	</p>
{:else}
	<article class="page">
		<section class="hero">
			<div class="hero-brand">
				<div class="hero-logo"><Holographic {seed} /></div>
				<h1><span>Re</span>spawn</h1>
			</div>
			<div class="heading subtitle">Track, save, and share what you’re playing</div>
			<div class="signin">
				<p>Press Start to begin</p>
				<a class="button primary" href="/login/"><div>Start</div></a>
			</div>
		</section>
	</article>
{/if}

<style>
.hero {
	display: flex;
	flex-direction: column;
	gap: 64px;
	align-items: center;
	padding: 64px 0;
	color: var(--color-grey-050);
}

.hero-brand {
	display: flex;
	flex-direction: column;
	gap: 32px;
	align-items: center;

	> h1 {
		font-size: 2.5rem;
		font-weight: 600;
		text-box: trim-both cap alphabetic;

		> span {
			font-weight: 800;
		}
	}
}

.hero-logo {
	position: relative;
	inline-size: 96px;
	block-size: 96px;
	mask-image: url('./logo.svg');
	mask-repeat: no-repeat;
	mask-size: contain;
}

.subtitle {
	padding: 0 16px;
	text-align: center;
}

.signin {
	display: flex;
	flex-direction: column;
	gap: 8px;
	align-items: center;

	> p {
		color: var(--color-grey-400);
		text-box: trim-both cap alphabetic;
	}
}

.sub {
	font-size: var(--text-sm);
	color: var(--color-muted);
}
</style>
