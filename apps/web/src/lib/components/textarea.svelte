<script lang="ts">
import type { Snippet } from 'svelte'
import type { HTMLTextareaAttributes } from 'svelte/elements'
import InputField, { type Tone } from './input-field.svelte'

interface Props extends Omit<HTMLTextareaAttributes, 'id' | 'disabled' | 'value'> {
	id?: string
	value?: string
	label?: string | Snippet
	tertiaryLabel?: string | Snippet
	description?: string | Snippet
	message?: string | Snippet
	tone?: Tone
	reserveMessageSpace?: boolean
	disabled?: boolean
	rows?: number
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
	rows = 2,
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
		<textarea class="input" {rows} bind:value {...rest} {...field}></textarea>
	{/snippet}
</InputField>

<style>
.input {
	padding: 8px 12px;
	font-family: inherit;
	font-size: 1.0625rem;
	line-height: 1.4;
	color: var(--color-text);
	background: var(--color-grey-600);
	border: none;
	border-radius: 4px;
	field-sizing: content;
	resize: none;

	@supports (corner-shape: squircle) {
		border-radius: 8px;
		corner-shape: var(--corner-shape);
	}

	@supports not (field-sizing: content) {
		resize: vertical;
	}
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
