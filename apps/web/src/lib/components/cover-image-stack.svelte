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
			<li style:--index={10 - index}><CoverImage image={cover.coverUrl} /></li>
		{/each}
	</ul>
</div>

<style>
.stack-container {
	container-type: inline-size;
}

.stack {
	--cover-width: 25cqw;
	--cover-overlap: calc((6 * var(--cover-width) - 100cqw) / 5);

	display: flex;
	width: min-content;
	padding: 0;
	margin: 0;
	list-style: none;
	overflow: hidden;
	border-radius: 4px;

	@supports (corner-shape: squircle) {
		border-radius: 8px;
		corner-shape: var(--corner-shape);
	}

	li {
		z-index: var(--index, 1);
		width: var(--cover-width);
		margin-inline-start: calc(var(--cover-overlap, 0) * -1);
		box-shadow: 4px 0 16px 0 rgb(0 0 0 / 25%);

		&:first-child {
			margin-inline-start: 0;
		}
	}
}
</style>
