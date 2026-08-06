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
	<div>
		{#if page > 1}
			<a class="outline-button" href={href(page - 1)} aria-label="Previous page" rel="prev">
				<span>Newer</span>
			</a>
		{/if}
	</div>

	<ol class="pages">
		{#each items as item, index (index)}
			<li>
				{#if item === 'gap'}
					<span class="page" aria-hidden="true">…</span>
				{:else if item === page}
					<span class="page" aria-current="page"><span>{item}</span></span>
				{:else}
					<a class="page" href={href(item)} aria-label="Page {item}"><span>{item}</span></a>
				{/if}
			</li>
		{/each}
	</ol>

	<div>
		{#if page < totalPages}
			<a class="outline-button" href={href(page + 1)} aria-label="Next page" rel="next">
				<span>Older</span>
			</a>
		{/if}
	</div>
</nav>

<style>
.pagination {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 8px;

	> div {
		flex: 1 1 100%;

		&:last-of-type {
			text-align: right;
		}
	}
}

.pages {
	display: flex;
	align-items: center;
	gap: 8px;
	margin: 0;
	padding: 0;
	list-style: none;
}

.page {
	display: block;
	padding: 8px;
	font-size: 0.875rem;
	color: var(--color-grey-500);
	text-box: trim-both cap alphabetic;
	letter-spacing: 0.01em;

	&:is(a) {
		color: var(--color-blue-100);
		text-decoration: none;
		transition: all 100ms ease-out;

		&:hover {
			background-color: var(--color-grey-700);
		}

		&:active {
			scale: 0.98;
		}
	}

	&[aria-current='page'] {
		color: var(--color-grey-400);
	}
}
</style>
