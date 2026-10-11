<script lang="ts">
import { enhance } from '$app/forms'
import { page } from '$app/state'
import type { ActionData, PageData } from './$types'

let { data, form }: { data: PageData; form: ActionData } = $props()

let steam = $derived(data.accounts?.find((account) => account.provider === 'steam'))

/** What came back from "Sign in through Steam", via the callback's redirect. */
const OUTCOMES: Record<string, { text: string; error?: boolean }> = {
	linked: { text: 'Steam connected. New plays will show up in your inbox.' },
	private: {
		text: 'Steam connected, but your game details are private, so we can’t see your plays yet.',
		error: true,
	},
	conflict: { text: 'That Steam account is already connected to another user.', error: true },
	cancelled: { text: 'Steam sign-in was cancelled.' },
	failed: { text: 'Couldn’t verify your Steam sign-in. Try again.', error: true },
	error: { text: 'Couldn’t connect Steam right now. Try again shortly.', error: true },
}

let outcome = $derived(OUTCOMES[page.url.searchParams.get('steam') ?? ''])

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
</script>

<svelte:head>
	<title>Connections ▪ Respawn</title>
</svelte:head>

<article class="page">
	<header>
		<h1>Connections</h1>
		<p class="sub">
			Connect a gaming account and the games you play there show up in
			<a href="/plays/">your inbox</a>, ready to log. Nothing is posted until you log it.
		</p>
	</header>

	{#if outcome}
		<p class={['notice', outcome.error && 'error']} role="status">{outcome.text}</p>
	{/if}
	{#if form?.error}
		<p class="notice error" role="status">{form.error}</p>
	{/if}

	{#if data.accounts === null}
		<p class="notice error">Connections are unavailable right now. Try again shortly.</p>
	{:else}
		<section class="connection">
			<div class="connection-info">
				<h2>Steam</h2>
				{#if !steam}
					<p class="sub">Your profile’s game details must be public.</p>
				{:else if steam.status === 'private'}
					<p class="sub error">
						Your game details are private. In Steam, set Profile › Privacy Settings › Game details
						to Public.
					</p>
				{:else if steam.status === 'error'}
					<p class="sub error">Steam didn’t answer last time. We’ll keep trying.</p>
				{:else if steam.lastSyncedAt}
					<p class="sub">Checked {dateFormat.format(new Date(steam.lastSyncedAt))}</p>
				{/if}
			</div>

			{#if steam}
				<form method="POST" action="?/unlink" use:enhance>
					<input type="hidden" name="id" value={steam.id} />
					<button class="button" type="submit"><div>Disconnect</div></button>
				</form>
			{:else}
				<!-- A full navigation, not a client-side one: it leaves for Steam. -->
				<a class="button primary" href="/settings/connections/steam/" data-sveltekit-reload>
					<div>Connect Steam</div>
				</a>
			{/if}
		</section>
	{/if}
</article>

<style>
.page {
	display: grid;
	gap: 32px;
	max-inline-size: 40rem;
	padding: 32px 0;
}

header {
	display: grid;
	gap: 16px;
}

h1 {
	font-size: 1.5rem;
	font-weight: 600;
	line-height: 1.2;
	text-box: trim-both cap alphabetic;
}

h2 {
	font-size: 1rem;
	font-weight: 600;
}

.sub {
	font-size: var(--text-sm);
	color: var(--color-grey-600);
}

.connection {
	display: flex;
	gap: 16px;
	align-items: center;
	justify-content: space-between;
}

.connection-info {
	display: grid;
	gap: 4px;
}

.notice {
	font-size: var(--text-sm);
}

.error {
	color: var(--color-pink-600);
}
</style>
