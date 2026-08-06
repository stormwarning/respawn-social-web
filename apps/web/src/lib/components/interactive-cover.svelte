<script lang="ts">
import CoverImage from './cover-image.svelte'

interface Props {
	href: string
	imageUrl: string | null
	title: string
}

let { href, imageUrl, title }: Props = $props()
</script>

<a {href} aria-label={title}>
	<CoverImage image={imageUrl} />
</a>

<style>
a {
	border-radius: 4px;

	@supports (corner-shape: squircle) {
		border-radius: 8px;
		corner-shape: var(--corner-shape);
	}
}
</style>
