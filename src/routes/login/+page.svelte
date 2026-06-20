<script lang="ts">
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head>
	<title>Log in · Respawn Social</title>
</svelte:head>

<h1>Log in</h1>
<p>Sign in with your AT Protocol / Bluesky identity.</p>

<form method="POST" class="login">
	<label for="handle">Handle or DID</label>
	<input
		id="handle"
		name="handle"
		type="text"
		placeholder="alice.bsky.social"
		autocomplete="username"
		required
	/>
	{#if form?.error}
		<p class="error">{form.error}</p>
	{/if}
	<button type="submit">Continue</button>
</form>

<style>
	.login {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		max-width: 22rem;
	}

	label {
		font-size: var(--text-sm);
		color: var(--color-muted);
	}

	input {
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
	}

	button {
		margin-top: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border: none;
		border-radius: var(--radius);
		background: var(--color-accent);
		color: #07101f;
		font-weight: 600;
		cursor: pointer;
	}

	.error {
		color: #ff8a8a;
		font-size: var(--text-sm);
	}
</style>
