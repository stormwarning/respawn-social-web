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
	overflow: hidden;
	background: var(--color-grey-400);
	border-radius: 999px;

	&::after {
		position: absolute;
		inset: 0;
		content: '';
		border-radius: 999px;
		box-shadow: inset 0 0 0 1px rgb(255 255 255 / 25%);
	}

	img {
		inline-size: 100%;
		max-inline-size: 100%;
		object-fit: cover;
	}
}
</style>
