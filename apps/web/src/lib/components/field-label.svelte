<script lang="ts">
import type { Snippet } from 'svelte'
import type { HTMLAttributes } from 'svelte/elements'

interface Props extends HTMLAttributes<HTMLDivElement> {
	description?: string | Snippet
	descriptionId?: string
	disabled?: boolean
	/** Id of the field this labels.  When omitted, renders a `<span>` instead of a `<label>`. */
	for?: string
	label?: string | Snippet
	tertiaryLabel?: string | Snippet
}

let {
	description,
	descriptionId,
	disabled = false,
	for: htmlFor,
	label,
	tertiaryLabel,
	...rest
}: Props = $props()
</script>

{#snippet content(value: string | Snippet)}
	{#if typeof value === 'function'}{@render value()}{:else}{value}{/if}
{/snippet}

{#if label || description}
	<div class="field-label" {...rest}>
		{#if label}
			<span class="row">
				{#if htmlFor}
					<label class={['label', { disabled }]} for={htmlFor}>{@render content(label)}</label>
				{:else}
					<span class={['label', { disabled }]}>{@render content(label)}</span>
				{/if}
				{#if tertiaryLabel}
					<span class="tertiary">{@render content(tertiaryLabel)}</span>
				{/if}
			</span>
		{/if}
		{#if description}
			<span class="description" id={descriptionId}>{@render content(description)}</span>
		{/if}
	</div>
{/if}

<style>
.field-label {
	display: flex;
	flex-direction: column;
	gap: var(--space-1);
}

.row {
	display: flex;
	justify-content: space-between;
	align-items: baseline;
	gap: var(--space-2);
}

.label {
	font-weight: 600;
}

.label.disabled {
	color: var(--color-muted);
}

.tertiary,
.description {
	color: var(--color-muted);
}

.description {
	font-size: var(--text-sm);
}
</style>
