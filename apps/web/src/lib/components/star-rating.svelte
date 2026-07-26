<script lang="ts">
import IconStarSolid from './icons/icon-star-solid.svelte'

let {
	value = $bindable(0),
	disabled = false,
	label = 'Rating',
	onchange,
}: {
	/** 0–10 in half-star steps; 0 means unrated. */
	value?: number
	disabled?: boolean
	label?: string
	onchange?: (value: number) => void
} = $props()

const STARS = [1, 2, 3, 4, 5]

let el: HTMLDivElement
let hovered = $state(0)

let display = $derived(hovered || value)
/** 1-based index of the star under the pointer, or being previewed by keyboard. */
let hoveredStar = $derived(Math.ceil(hovered / 2))

const clamp = (n: number) => Math.min(10, Math.max(0, n))

/** Portion of star `i` (1-based) that should be filled: 0, 0.5 or 1. */
const fill = (i: number) => Math.min(2, Math.max(0, display - (i - 1) * 2)) / 2

/** Nearest half-star to a pointer position, as a 1–10 value. */
function valueAt(event: PointerEvent | MouseEvent) {
	const rect = el.getBoundingClientRect()
	const ratio = (event.clientX - rect.left) / rect.width
	return clamp(Math.ceil(ratio * 10)) || 1
}

function commit(next: number) {
	if (next === value) return
	value = next
	onchange?.(next)
}

function onpointermove(event: PointerEvent) {
	if (disabled || event.pointerType === 'touch') return
	hovered = valueAt(event)
}

function onclick(event: MouseEvent) {
	if (disabled) return
	const next = valueAt(event)
	// Clicking the current value clears the rating.
	commit(next === value ? 0 : next)
	hovered = 0
}

function onkeydown(event: KeyboardEvent) {
	if (disabled) return

	// Arrows only preview; the rating is committed on Enter.
	if (event.key === 'Enter' || event.key === ' ') {
		if (!hovered) return
		event.preventDefault()
		commit(hovered)
		hovered = 0
		return
	}

	const base = hovered || value
	const next = {
		ArrowRight: base + 1,
		ArrowUp: base + 1,
		ArrowLeft: base - 1,
		ArrowDown: base - 1,
		Home: 0,
		End: 10,
	}[event.key]
	if (next == null) return
	event.preventDefault()
	hovered = clamp(next)
}
</script>

<div
	bind:this={el}
	class="star-rating"
	role="slider"
	aria-label={label}
	aria-valuemin={0}
	aria-valuemax={10}
	aria-valuenow={value}
	aria-valuetext={value ? `${value / 2} stars` : 'No rating'}
	aria-disabled={disabled ? 'true' : undefined}
	tabindex={disabled ? -1 : 0}
	{onpointermove}
	onpointerleave={() => (hovered = 0)}
	onblur={() => (hovered = 0)}
	{onclick}
	{onkeydown}
>
	{#each STARS as star (star)}
		<span
			class="star"
			style="--fill: {fill(star)}"
			data-is-hovered={star === hoveredStar ? '' : undefined}
		>
			<span class="star-empty"><IconStarSolid /></span>
			<span class="star-fill"><IconStarSolid /></span>
		</span>
	{/each}
</div>

<style>
.star-rating {
	display: flex;
	padding: 4px;
	color: var(--color-grey-600);
	border-radius: 4px;
	user-select: none;
	touch-action: manipulation;
	-webkit-tap-highlight-color: transparent;

	@supports (corner-shape: squircle) {
		border-radius: 8px;
		corner-shape: var(--corner-shape);
	}

	&:focus-visible {
		outline: 2px solid var(--color-blue-500);
		outline-offset: 2px;
	}

	&[aria-disabled='true'] {
		cursor: default;
	}
}

.star {
	position: relative;
	display: flex;

	:global(> span > svg) {
		width: 32px;
		height: 32px;
	}

	&[data-is-hovered] {
		> .star-empty,
		> .star-fill {
			scale: 1.2;
		}
	}
}

.star-empty,
.star-fill {
	transition: scale 100ms ease-out;
}

.star-empty {
	display: flex;
	opacity: 0.5;
	mix-blend-mode: hard-light;
}

.star-fill {
	position: absolute;
	inset: 0;
	display: flex;
	color: var(--color-green-500);
	clip-path: inset(0 calc((1 - var(--fill)) * 100%) 0 0);
}
</style>
