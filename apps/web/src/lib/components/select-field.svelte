<script lang="ts">
import type { Snippet } from 'svelte'
import type { HTMLSelectAttributes } from 'svelte/elements'
import InputField, { type Tone } from './input-field.svelte'

interface Props extends Omit<HTMLSelectAttributes, 'id' | 'disabled' | 'value'> {
	id?: string
	value?: string
	label?: string | Snippet
	tertiaryLabel?: string | Snippet
	description?: string | Snippet
	message?: string | Snippet
	tone?: Tone
	reserveMessageSpace?: boolean
	disabled?: boolean
	/** The `<option>` (and `<optgroup>`) elements to render. */
	children?: Snippet
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
	children: options,
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
		<div class="select-wrapper">
			<select class="input" bind:value {...rest} {...field}>
				{@render options?.()}
			</select>
		</div>
	{/snippet}
</InputField>

<style>
.select-wrapper {
	position: relative;
	display: grid;
}

.select-wrapper::after {
	position: absolute;
	inset-block-start: 50%;
	inset-inline-end: 12px;
	inline-size: 10px;
	block-size: 6px;
	pointer-events: none;
	content: '';
	background: currentcolor;
	clip-path: polygon(0 0, 100% 0, 50% 100%);
	translate: 0 -50%;
}

.input {
	padding: 8px 32px 8px 12px;
	font-family: inherit;
	font-size: 1.0625rem;
	color: var(--color-text);
	appearance: none;
	cursor: pointer;
	background: var(--color-grey-600);
	border: none;
	border-radius: 4px;

	@supports (corner-shape: squircle) {
		border-radius: 8px;
		corner-shape: var(--corner-shape);
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
	cursor: default;
}

.select-wrapper:has(.input:disabled)::after {
	color: var(--color-muted);
}
</style>
