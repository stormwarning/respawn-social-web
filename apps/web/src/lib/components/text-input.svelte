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

<InputField
	{id}
	{label}
	{tertiaryLabel}
	{description}
	{message}
	{tone}
	{reserveMessageSpace}
	{disabled}
>
	{#snippet children(field)}
		<input class="input" type="text" bind:value {...rest} {...field} />
	{/snippet}
</InputField>

<style>
.input {
	padding: 8px 12px;
	font-size: 1.0625rem;
	color: var(--color-text);
	background: var(--color-grey-600);
	border: none;
	border-radius: 8px;
	corner-shape: var(--corner-shape);
}

.input:focus-visible {
	outline: 2px solid var(--color-accent);
	outline-offset: 2px;
}

.input[aria-invalid='true'] {
	border-color: var(--color-critical);
}

.input:disabled {
	color: var(--color-muted);
}
</style>
