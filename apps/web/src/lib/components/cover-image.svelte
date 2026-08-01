<script>
let { image } = $props()
</script>

<div class="cover">
	{#if image}<img src={image} alt="" loading="lazy" />{/if}
</div>

<style>
.cover {
	position: relative;
	aspect-ratio: 3/4;
	object-fit: cover;
	background: var(--color-grey-400);
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
		width: 100%;
		max-width: 100%;
		object-fit: contain;
	}
}
</style>
