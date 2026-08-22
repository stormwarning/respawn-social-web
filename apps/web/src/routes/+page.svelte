<script lang="ts">
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()
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
			<h1><span>Re</span>spawn</h1>
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
	align-items: center;
	gap: 64px;
	padding: 64px 0;
	color: var(--color-grey-050);

	> h1 {
		font-size: 2.5rem;
		font-weight: 600;
		text-box: trim-both cap alphabetic;

		> span {
			font-weight: 800;
		}
	}
}

.subtitle {
	padding: 0 16px;
	text-align: center;
}

.signin {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;

	> p {
		color: var(--color-grey-400);
		text-box: trim-both cap alphabetic;
	}
}

.sub {
	color: var(--color-muted);
	font-size: var(--text-sm);
}
</style>
