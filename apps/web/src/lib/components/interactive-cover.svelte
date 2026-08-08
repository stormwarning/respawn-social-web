<script lang="ts">
import CoverImage from './cover-image.svelte'

interface Props {
	href: string
	imageUrl: string | null
	title: string
	loading?: 'lazy' | 'eager'
}

let { href, imageUrl, title, loading = 'lazy' }: Props = $props()
</script>

<a {href} aria-label={title}>
	<CoverImage image={imageUrl} {loading} />
</a>

<style>
a {
	display: flex;
	border-radius: 4px;

	@supports (corner-shape: squircle) {
		border-radius: 8px;
		corner-shape: var(--corner-shape);
	}
}
</style>
