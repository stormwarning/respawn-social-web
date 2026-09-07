<script lang="ts">
import { createHolographic, toDataURI } from '$lib/holographic'

/**
 * Fill-parent holographic surface. Mask-agnostic: the parent decides the shape
 * (`mask-image`, `border-radius`, …) and must be `position: relative`.
 */
let { seed, animate = true }: { seed: string; animate?: boolean } = $props()

const spec = $derived(createHolographic(seed))
</script>

<div
	class={['holographic', { animate }]}
	style:--holo-image={toDataURI(spec)}
	style:--holo-duration="{spec.motion.duration}s"
	style:--holo-direction={spec.motion.direction}
	style:--holo-drift="{spec.motion.drift}%"
	style:--holo-hue="{spec.motion.hueDrift}deg"
	aria-hidden="true"
></div>

<style>
/* Direction flips the whole path via the sign of the drift. */
@keyframes holo-drift {
	from {
		filter: hue-rotate(0deg);
		rotate: calc(-3deg * var(--holo-direction));
		translate: calc(var(--holo-drift) * var(--holo-direction) * -1)
			calc(var(--holo-drift) * var(--holo-direction) * 0.5);
	}

	to {
		filter: hue-rotate(var(--holo-hue));
		rotate: calc(3deg * var(--holo-direction));
		translate: calc(var(--holo-drift) * var(--holo-direction))
			calc(var(--holo-drift) * var(--holo-direction) * -0.5);
	}
}

.holographic {
	position: absolute;
	inset: 0;
	overflow: hidden;

	/* Oversized so the drift never exposes an edge. */
	&::before {
		position: absolute;
		inset: -30%;
		content: '';
		background-image: var(--holo-image);
		background-size: 100% 100%;
		will-change: transform;
	}

	&.animate::before {
		animation: holo-drift var(--holo-duration) ease-in-out infinite alternate;

		@media (prefers-reduced-motion: reduce) {
			animation: none;
		}
	}
}
</style>
