<script lang="ts">
import type { Snippet } from 'svelte'
import type { HTMLInputAttributes } from 'svelte/elements'
import InputField, { type Tone } from './input-field.svelte'

interface Props extends Omit<HTMLInputAttributes, 'id' | 'disabled' | 'value'> {
	id?: string
	value?: string
	label?: string | Snippet
	tertiaryLabel?: string | Snippet
	description?: string | Snippet
	message?: string | Snippet
	tone?: Tone
	reserveMessageSpace?: boolean
	disabled?: boolean
}

let {
	id,
	value = $bindable(''),
	label,
	tertiaryLabel,
	description,
	message,
	tone,
	reserveMessageSpace,
	disabled,
	...rest
}: Props = $props()
</script>

<InputField {id} {label} {tertiaryLabel} {description} {message} {tone} {reserveMessageSpace} {disabled}>
	{#snippet children(field)}
		<input class="input" type="text" bind:value {...rest} {...field} />
	{/snippet}
</InputField>

<style>
.input {
	font: inherit;
	color: var(--color-text);
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius);
	padding: var(--space-2) var(--space-3);
}

.input:focus-visible {
	outline: 2px solid var(--color-accent);
	outline-offset: 1px;
}

.input[aria-invalid='true'] {
	border-color: var(--color-critical);
}

.input:disabled {
	color: var(--color-muted);
}
</style>
