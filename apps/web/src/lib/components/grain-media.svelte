<script lang="ts">
import type { GrainPhoto as Photo } from '$lib/atproto/grain'

interface Props {
	photos: Photo[]
	/** Where a tile links; defaults to the full-size image. */
	href?: (photo: Photo) => string
}

let { photos, href = (photo) => photo.fullsize }: Props = $props()

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const ratio = (photo: Photo) => photo.aspectRatio.width / photo.aspectRatio.height

/** Bluesky-style: one, two, three, four, then a horizontal strip. */
let layout = $derived(
	photos.length > 4 ? 'strip' : (['one', 'two', 'three', 'four'] as const)[photos.length - 1],
)
</script>

{#snippet tile(photo: Photo, index: number)}
	<a
		class="tile"
		href={href(photo)}
		target="_blank"
		rel="noopener noreferrer"
		style:--ratio={layout === 'one' || layout === 'strip'
			? clamp(ratio(photo), 0.75, 2)
			: undefined}
	>
		<img
			src={photo.thumb}
			alt={photo.alt ?? ''}
			width={photo.aspectRatio.width * 100}
			height={photo.aspectRatio.height * 100}
			loading={index > 2 ? 'lazy' : undefined}
			draggable="false"
		/>
		{#if photo.alt}<span class="alt" title={photo.alt}>ALT</span>{/if}
	</a>
{/snippet}

{#if layout}
	{#if layout === 'strip'}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div
			class="media strip"
			role="region"
			aria-label={`${photos.length} photos, scrolls sideways`}
			tabindex="0"
		>
			{#each photos as photo, i (photo.uri + i)}{@render tile(photo, i)}{/each}
		</div>
	{:else}
		<div class={['media', layout]}>
			{#each photos as photo, i (photo.uri + i)}{@render tile(photo, i)}{/each}
		</div>
	{/if}
{/if}

<style>
.media {
	--size: 24rem;
	--strip-height: 16rem;
	--radius: 8px;

	display: grid;
	gap: 4px;
	inline-size: 100%;

	&:not(.one, .strip) {
		max-inline-size: calc(var(--size) * 1.75);
	}
}

.tile {
	position: relative;
	display: block;
	min-inline-size: 0;
	min-block-size: 0;
	overflow: hidden;
	outline-offset: 2px;
	background: var(--color-grey-800);
	border-radius: var(--radius);

	@supports (corner-shape: squircle) {
		border-radius: calc(var(--radius) * 2);
		corner-shape: var(--corner-shape);
	}

	/* Hairline so light photos don't bleed into the page. */
	&::after {
		position: absolute;
		inset: 0;
		pointer-events: none;
		content: '';
		border: 1px solid rgb(255 255 255 / 8%);
		border-radius: inherit;
	}

	&:focus-visible {
		outline: 2px solid var(--color-accent);
	}
}

/* Out of flow, so intrinsic image sizes don't stretch the grid rows. */
img {
	position: absolute;
	inset: 0;
	display: block;
	inline-size: 100%;
	block-size: 100%;
	object-fit: cover;
}

.alt {
	position: absolute;
	inset-block-end: 6px;
	inset-inline-start: 6px;
	padding: 1px 5px;
	font-size: 0.6875rem;
	font-weight: 700;
	color: rgb(255 255 255);
	letter-spacing: 0.02em;
	background: rgb(0 0 0 / 60%);
	border-radius: 4px;
}

.one .tile {
	inline-size: min(100%, var(--size) * var(--ratio));
	aspect-ratio: var(--ratio);
}

.two {
	grid-template-columns: 1fr 1fr;

	.tile {
		aspect-ratio: 1;
	}
}

.three,
.four {
	grid-template-rows: 1fr 1fr;
	grid-template-columns: 1fr 1fr;
	aspect-ratio: 3 / 2;
}

.strip {
	display: flex;
	padding-block-end: 4px;
	overflow-inline: auto;
	overscroll-behavior-inline: contain;
	outline-offset: 2px;
	scroll-snap-type: x mandatory;
	scrollbar-width: thin;
	border-radius: var(--radius);

	.tile {
		flex: none;
		block-size: var(--strip-height);
		aspect-ratio: var(--ratio);
		scroll-snap-align: start;
	}

	&:focus-visible {
		outline: 2px solid var(--color-accent);
	}
}

.three .tile:first-child {
	grid-row: span 2;
}
</style>
