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
	max-inline-size: 100%;
	aspect-ratio: 3/4;
	overflow: hidden;
	background: var(--color-grey-600);
	border-radius: 4px;

	@supports (corner-shape: squircle) {
		border-radius: 8px;
		corner-shape: var(--corner-shape);
	}

	&::after {
		position: absolute;
		inset: 0;
		content: '';
		border-radius: 4px;
		box-shadow: inset 0 0 0 1px rgb(255 255 255 / 25%);

		@supports (corner-shape: squircle) {
			border-radius: 8px;
			corner-shape: var(--corner-shape);
		}
	}

	img {
		grid-area: 1 / 1;
		inline-size: 100%;
		block-size: 100%;
		text-decoration: none;
		object-fit: contain;
		scale: 1;

		&:not(:last-of-type) {
			object-fit: cover;
			filter: blur(8px);
			scale: 1.2;
		}
	}
}

.title {
	display: grid;
	grid-area: 1 / 1;
	place-items: center;
	padding: 4px;
	overflow: hidden;
	font-size: 0.875rem;
	text-align: center;
}
</style>
