<script lang="ts">
const TRUNCATE_AT = 155

let { text }: { text: string } = $props()
let truncatedText = $derived(text.slice(0, 150))
let needsTruncation = $derived(text.length > TRUNCATE_AT)
let truncatedHeight = $state(0)
let isExpanded = $state(false)

function toggle() {
	isExpanded = !isExpanded
}
</script>

<div class="text-wrapper">
	<div
		class={{ text: true, 'is-expanded': isExpanded || !needsTruncation }}
		style={needsTruncation && truncatedHeight > 0 ? `--clamp-height: ${truncatedHeight}px` : ''}
	>
		<p>
			{text}
			{#if needsTruncation}
				<button class="toggle" onclick={toggle}>&nbsp;&times;&nbsp;</button>
			{/if}
		</p>
	</div>
	{#if needsTruncation}
		<div class="truncated" aria-hidden="true" bind:clientHeight={truncatedHeight}>
			<p>
				{truncatedText} <button class="toggle" onclick={toggle} tabindex="-1">…more</button>
			</p>
		</div>
	{/if}
</div>

<style>
.text-wrapper {
	position: relative;
}

/* Declared before `.text` so the `& ~ .truncated` override below it wins on
   source order as well as specificity. */
.truncated {
	position: absolute;
	inset-block-start: 0;
	transition: opacity 75ms linear;
}

.text {
	block-size: var(--clamp-height, auto);
	overflow-inline: visible;
	overflow-block: clip;
	opacity: 0;
	interpolate-size: allow-keywords;
	transition:
		opacity 200ms ease-out,
		height 200ms ease-out allow-discrete;

	&.is-expanded {
		block-size: auto;
		opacity: 1;

		& ~ .truncated {
			pointer-events: none;
			opacity: 0;
			transition-delay: 100ms;
		}
	}
}

.toggle {
	padding: 0;
	font: inherit;
	color: var(--color-blue-200);
	appearance: none;
	background: none;
	border: none;

	&:hover {
		color: var(--color-blue-050);
	}
}
</style>
