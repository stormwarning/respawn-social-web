<script lang="ts">
import InteractiveCover from './interactive-cover.svelte'

let { items } = $props()
</script>

<ul class="cover-list">
	{#each items as item, index (item.igdbId)}
		<li>
			<InteractiveCover href="/game/{item.slug}/" imageUrl={item.coverUrl} title={item.title} />
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
