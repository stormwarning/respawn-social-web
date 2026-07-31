<script lang="ts">
import { paginationItems } from './pagination'

let {
	page,
	totalPages,
	basePath,
	label = 'Pagination',
}: {
	page: number
	totalPages: number
	/** Path the pages hang off, without a trailing slash: /alice.test/backlog */
	basePath: string
	label?: string
} = $props()

let items = $derived(paginationItems(page, totalPages))

const href = (n: number) => (n === 1 ? `${basePath}/` : `${basePath}/page/${n}/`)
</script>

<nav class="pagination" aria-label={label}>
	{#if page > 1}
		<a class="button small" href={href(page - 1)} aria-label="Previous page" rel="prev">
			<span>Previous</span>
		</a>
	{:else}
		<span class="button small is-disabled" aria-label="Previous page" aria-disabled="true">
			<span>Previous</span>
		</span>
	{/if}

	<ol class="pages">
		{#each items as item, index (index)}
			<li>
				{#if item === 'gap'}
					<span class="gap" aria-hidden="true">…</span>
				{:else if item === page}
					<span class="button small is-current" aria-current="page"><span>{item}</span></span>
				{:else}
					<a class="button small" href={href(item)} aria-label="Page {item}"><span>{item}</span></a>
				{/if}
			</li>
		{/each}
	</ol>

	{#if page < totalPages}
		<a class="button small" href={href(page + 1)} aria-label="Next page" rel="next">
			<span>Next</span>
		</a>
	{:else}
		<span class="button small is-disabled" aria-label="Next page" aria-disabled="true">
			<span>Next</span>
		</span>
	{/if}
</nav>

<style>
.pagination {
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	align-items: center;
	gap: 8px;
}

.pages {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
	margin: 0;
	padding: 0;
	list-style: none;
}

.is-current {
	color: var(--color-grey-050);
	background-color: var(--color-grey-800);
}

.is-disabled {
	color: var(--color-muted);
	opacity: 0.5;
	pointer-events: none;
}

.gap {
	display: block;
	padding: 0 4px;
	color: var(--color-muted);
	text-box: trim-both cap alphabetic;
}
</style>
