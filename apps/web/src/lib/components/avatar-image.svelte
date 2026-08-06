<script lang="ts">
interface Props {
	image: string | null | undefined
	/**
	 * The header and profile avatars are above the fold on every page; they pass
	 * "eager" so the browser stops deferring the most prominent image.
	 */
	loading?: 'lazy' | 'eager'
}

let { image, loading = 'lazy' }: Props = $props()
</script>

<div class="avatar">
	{#if image}
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
