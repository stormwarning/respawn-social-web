<script lang="ts">
interface Props {
	image: string | null | undefined
	/**
	 * Callers that render above the fold pass "eager"; those covers are the LCP
	 * candidate, so they also get priority over the rest of the page's images.
	 */
	loading?: 'lazy' | 'eager'
	title?: string
}

let { image, loading = 'lazy', title }: Props = $props()
</script>

<div class="cover">
	<div class="title" role="presentation">
		{title}
	</div>
	{#if image}
		<img
			src={image}
			alt=""
			{loading}
			decoding="async"
			fetchpriority={loading === 'eager' ? 'high' : 'auto'}
		/>
		<img
			src={image}
			alt=""
			{loading}
			decoding="async"
			fetchpriority={loading === 'eager' ? 'high' : 'auto'}
		/>
	{/if}
</div>

<style>
.cover {
	position: relative;
	display: grid;
	aspect-ratio: 3/4;
	max-width: 100%;
	background: var(--color-grey-600);
	border-radius: 4px;
	overflow: hidden;

	@supports (corner-shape: squircle) {
		border-radius: 8px;
		corner-shape: var(--corner-shape);
	}

	&::after {
		position: absolute;
		inset: 0;
		border-radius: 4px;
		box-shadow: inset 0 0 0 1px rgb(255 255 255 / 25%);
		content: '';

		@supports (corner-shape: squircle) {
			border-radius: 8px;
			corner-shape: var(--corner-shape);
		}
	}

	img {
		grid-area: 1 / 1;
		width: 100%;
		height: 100%;
		object-fit: contain;
		text-decoration: none;
		scale: 1;

		&:not(:last-of-type) {
			object-fit: cover;
			scale: 1.2;
			filter: blur(8px);
		}
	}
}

.title {
	grid-area: 1 / 1;
	display: grid;
	place-items: center;
	padding: 4px;
	font-size: 0.875rem;
	text-align: center;
}
</style>
