<script lang="ts">
import type { Snippet } from 'svelte'

interface Props {
	children: Snippet
	secondary?: Snippet | number
}

let { children, secondary }: Props = $props()
</script>

<h2 class="section-heading">
	<div>{@render children()}</div>
	<div class="lines">
		<div class="hairline"></div>
		<div class="hairline"></div>
		<div class="hairline"></div>
	</div>
	{#if secondary}
		<div class="secondary">{secondary}</div>
	{/if}
</h2>

<style>
.section-heading {
	display: flex;
	gap: 16px;
	align-items: center;
	font-size: 0.875rem;
	font-weight: 400;
	line-height: 1.2;
	color: var(--color-grey-400);
	text-transform: uppercase;

	> div {
		text-box: trim-both cap alphabetic;
	}

	:global(a) {
		text-decoration: none;

		&:hover {
			color: var(--color-grey-100);
		}
	}
}

.lines {
	display: grid;
	flex: 1 1 auto;
	gap: round(calc(1cap / 3), 1px);
	align-content: center;
}

.hairline {
	inline-size: 100%;
	block-size: 1px;
	background-color: var(--color-grey-500);
	opacity: 0.4;
}

.secondary {
	font-size: 0.75rem;
	color: var(--color-grey-500);
}
</style>
