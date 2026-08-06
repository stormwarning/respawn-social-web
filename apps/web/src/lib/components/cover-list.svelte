<script lang="ts">
import InteractiveCover from './interactive-cover.svelte'

let { items } = $props()

// Widest layout is 6 columns, so this covers the first row at every breakpoint.
const EAGER_COUNT = 6
</script>

<ul class="cover-list">
	{#each items as item, index (item.igdbId)}
		<li>
			<InteractiveCover
				href="/game/{item.slug}/"
				imageUrl={item.coverUrl}
				title={item.title}
				loading={index < EAGER_COUNT ? 'eager' : 'lazy'}
			/>
		</li>
	{/each}
</ul>

<style>
.cover-list {
	--cols: 4;

	display: grid;
	grid-template-columns: repeat(var(--cols), 1fr);
	gap: 8px;
	padding: 0;
	margin: 0;
	list-style: none;

	@container (min-width: 600px) {
		--cols: 6;
	}

	> li {
		display: flex;
	}
}
</style>
