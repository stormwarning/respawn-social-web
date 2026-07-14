<script lang="ts">
import TextInput from '$lib/components/text-input.svelte'
import type { ActionData } from './$types'

let { form }: { form: ActionData } = $props()
</script>

<svelte:head>
	<title>Sign in · Respawn Social</title>
</svelte:head>

<h1>Sign in with your ATmosphere account.</h1>

<form method="POST" class="login">
	<TextInput
		label="Account name"
		message={form?.error}
		id="handle"
		name="handle"
		placeholder="alice.bsky.social"
		autocomplete="username"
		required
		inputmode="url"
	/>
	<button type="submit">Continue</button>
</form>

<style>
.login {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
	max-width: 22rem;
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
</style>
