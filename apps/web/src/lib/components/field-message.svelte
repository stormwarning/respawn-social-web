<script lang="ts">
import type { Snippet } from 'svelte'
import type { HTMLAttributes } from 'svelte/elements'

type Tone = 'neutral' | 'critical' | 'positive' | 'caution'

interface Props extends HTMLAttributes<HTMLDivElement> {
	id: string
	disabled?: boolean
	message?: string | Snippet
	/** Keep the message's vertical space when there is no message, so layout doesn't jump. */
	reserveMessageSpace?: boolean
	tone?: Tone
}

let {
	id,
	disabled = false,
	message,
	reserveMessageSpace = true,
	tone = 'neutral',
	...rest
}: Props = $props()

let showMessage = $derived(!disabled && Boolean(message))
</script>

{#if message || reserveMessageSpace}
	<div {id} class={['body sm secondary', tone, { placeholder: !showMessage }]} {...rest}>
		{#if showMessage && message}
			{#if typeof message === 'function'}{@render message()}{:else}{message}{/if}
		{:else}
			&nbsp;
		{/if}
	</div>
{/if}

<style>
.field-message {
	font-size: var(--text-sm);
	color: var(--color-muted);
}

.critical {
	color: var(--color-critical);
}

.positive {
	color: var(--color-positive);
}

.caution {
	color: var(--color-caution);
}

.placeholder {
	user-select: none;
}
</style>
