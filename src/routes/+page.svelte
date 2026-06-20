<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Respawn Social</title>
</svelte:head>

{#if data.loggedIn}
	<h1>Your feed</h1>
	<p>You're signed in. Feed records will render here (SSR) once lexicons land.</p>
{:else}
	<h1>Respawn Social</h1>
	<p>A game-focused social app on the AT Protocol.</p>
	<p><a href="/login">Log in with Bluesky</a> to get started.</p>
{/if}
