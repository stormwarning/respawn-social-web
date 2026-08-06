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

.text {
	height: var(--clamp-height, auto);
	overflow: hidden;
	opacity: 0;
	interpolate-size: allow-keywords;
	transition:
		opacity 200ms ease-out,
		height 200ms ease-out allow-discrete;

	&.is-expanded {
		height: auto;
		opacity: 1;

		& ~ .truncated {
			opacity: 0;
			pointer-events: none;
			transition-delay: 100ms;
		}
	}
}

.truncated {
	position: absolute;
	top: 0;
	transition: opacity 75ms linear;
}

.toggle {
	padding: 0;
	appearance: none;
	background: none;
	border: none;
	font: inherit;
	color: var(--color-blue-200);

	&:hover {
		color: var(--color-blue-050);
	}
}
</style>
