<script lang="ts">
import CoverImage from '$lib/components/cover-image.svelte'

export interface StackCover {
	igdbId: number
	title: string
	coverUrl: string | null
}

let { covers }: { covers: StackCover[] } = $props()
</script>

<div class="stack-container">
	<ul class="stack">
		{#each covers as cover, index (cover.igdbId)}
			<li style:--index={10 - index}><CoverImage image={cover.coverUrl} title={cover.title} /></li>
		{/each}
	</ul>
</div>

<style>
.stack-container {
	container-type: inline-size;
}

.stack {
	--cover-width: 25cqi;
	--cover-overlap: calc((6 * var(--cover-width) - 100cqi) / 5);

	display: flex;
	inline-size: min-content;
	padding: 0;
	margin: 0;
	overflow: hidden;
	list-style: none;
	border-radius: 4px;

	@supports (corner-shape: squircle) {
		border-radius: 8px;
		corner-shape: var(--corner-shape);
	}

	li {
		z-index: var(--index, 1);
		inline-size: var(--cover-width);
		margin-inline-start: calc(var(--cover-overlap, 0) * -1);
		border-radius: 4px;
		box-shadow: 2px 0 8px 0 rgb(0 0 0 / 50%);

		@supports (corner-shape: squircle) {
			border-radius: 8px;
			corner-shape: var(--corner-shape);
		}

		&:first-child {
			margin-inline-start: 0;
		}
	}
}
</style>
