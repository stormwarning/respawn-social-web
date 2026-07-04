<script lang="ts">
import { enhance } from '$app/forms'
import type { ActionData } from './$types'

let { form }: { form: ActionData } = $props()
</script>

<svelte:head>
	<title>New list · Respawn Social</title>
</svelte:head>

<h1>New list</h1>

<form method="POST" class="list-form" use:enhance>
	<label for="name">Name</label>
	<input id="name" name="name" type="text" required maxlength="1000" />

	<label for="description">Description</label>
	<textarea id="description" name="description" rows="3" maxlength="30000"></textarea>

	<label><input name="ranked" type="checkbox" /> Ranked (order is a ranking)</label>

	{#if form?.error}<p class="error">{form.error}</p>{/if}

	<button type="submit">Create list</button>
</form>

<style>
.list-form {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
	max-width: 30rem;
}

label {
	font-size: var(--text-sm);
	color: var(--color-muted);
}

input:not([type='checkbox']),
textarea {
	padding: var(--space-2) var(--space-3);
	border: 1px solid var(--color-border);
	border-radius: var(--radius);
	background: var(--color-surface);
	color: var(--color-text);
	font: inherit;
}

button {
	padding: var(--space-2) var(--space-3);
	border: none;
	border-radius: var(--radius);
	background: var(--color-accent);
	color: #07101f;
	font-weight: 600;
	cursor: pointer;
	align-self: flex-start;
}

.error {
	color: #ff8a8a;
	font-size: var(--text-sm);
}
</style>
