<script lang="ts">
import { Icon } from '@respawn-social/icons'

interface Props {
	/** 1–10 in half-star steps, as records store it. */
	value: number
	/** Is the element used within inline text. */
	isInline?: boolean
	/** Star size in px. */
	size?: number
}

let { value, isInline = false, size = 18 }: Props = $props()

let full = $derived(Math.floor(value / 2))
let half = $derived(value % 2 === 1)
</script>

<span
	class="rating-stars {isInline && 'is-inline'}"
	role="img"
	aria-label="{value / 2} out of 5 stars"
	style:--size="{size}px"
>
	{#each { length: full }, i (i)}
		<Icon name="star-solid" />
	{/each}
	{#if half}
		<Icon name="star-half-solid" />
	{/if}
</span>

<style>
.rating-stars {
	display: inline-flex;
	gap: 1px;
	color: var(--color-green-500);

	:global(svg) {
		flex: none;
		inline-size: var(--size);
		block-size: var(--size);
	}

	&.is-inline {
		position: relative;
		top: 1.5px;
		color: inherit;
	}
}
</style>
