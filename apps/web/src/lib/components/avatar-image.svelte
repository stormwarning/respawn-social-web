<script>
let { image } = $props()
</script>

<div class="avatar">
	{#if image}<img src={image} alt="" loading="lazy" />{/if}
</div>

<style>
.avatar {
	position: relative;
	aspect-ratio: 1;
	background: var(--color-grey-400);
	border-radius: 999px;
	overflow: hidden;

	&::after {
		position: absolute;
		inset: 0;
		border-radius: 999px;
		box-shadow: inset 0 0 0 1px rgb(255 255 255 / 25%);
		content: '';
	}

	img {
		width: 100%;
		max-width: 100%;
		object-fit: cover;
	}
}
</style>
