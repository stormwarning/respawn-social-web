<script lang="ts">
import { browsePath, decadeOf, filterLabel, FIRST_DECADE, type GameFilters } from './filters'

interface Props {
	filters: GameFilters
	/** Passed in from the load so the server and client agree on the last year. */
	thisYear: number
}

let { filters, thisYear }: Props = $props()

let label = $derived(filterLabel(filters) ?? 'All years')

// Newest first, down to the earliest decade worth a page.
let decades = $derived.by(() => {
	const out: number[] = []
	for (let d = decadeOf(thisYear); d >= FIRST_DECADE; d -= 10) out.push(d)
	return out
})

/**
 * The decade whose years are shown. Starts on the selection's decade (or the
 * current one) so the menu opens where the reader already is; hovering or
 * focusing another decade swaps it. Without JS the years of that one decade
 * are still there, and every other decade is a click away.
 */
let selectedDecade = $derived(
	filters.year !== undefined ? decadeOf(filters.year) : (filters.decade ?? decadeOf(thisYear)),
)
let expanded = $derived(selectedDecade)

// Games get announced a year or so out, so the current decade runs one past.
let yearsOf = (decade: number) => {
	const last = Math.min(decade + 9, thisYear + 1)
	return Array.from({ length: last - decade + 1 }, (_, i) => decade + i)
}

let menu = $state<HTMLDetailsElement>()

function close() {
	if (menu) menu.open = false
}

function onPointerDown(event: PointerEvent) {
	if (menu?.open && !menu.contains(event.target as Node)) close()
}

function onKeyDown(event: KeyboardEvent) {
	if (event.key === 'Escape' && menu?.open) {
		close()
		menu?.querySelector('summary')?.focus()
	}
}
</script>

<svelte:document onpointerdown={onPointerDown} onkeydown={onKeyDown} />

<details class="menu" bind:this={menu}>
	<summary class="outline-button" aria-label="Filter by year: {label}">
		<span>{label}</span>
		<svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
			<path d="M0 0h10L5 6z" fill="currentcolor" />
		</svg>
	</summary>

	<div class="panel">
		<a class="all" href={browsePath({})} aria-current={label === 'All years' ? 'page' : undefined}>
			All years
		</a>
		<ul class="decades">
			{#each decades as decade (decade)}
				<li>
					<a
						href={browsePath({ decade })}
						aria-current={filters.decade === decade ? 'page' : undefined}
						aria-expanded={expanded === decade}
						onmouseenter={() => (expanded = decade)}
						onfocus={() => (expanded = decade)}
					>
						{decade}s
					</a>
					{#if expanded === decade}
						<ul class="years">
							{#each yearsOf(decade) as year (year)}
								<li>
									<a
										href={browsePath({ year })}
										aria-current={filters.year === year ? 'page' : undefined}
									>
										{year}
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
</details>

<style>
.menu {
	position: relative;
}

summary {
	gap: 8px;
	align-items: center;
	cursor: pointer;
	list-style: none;

	&::-webkit-details-marker {
		display: none;
	}

	svg {
		transition: rotate 100ms ease-out;
	}
}

.menu[open] summary svg {
	rotate: 180deg;
}

.panel {
	position: absolute;
	inset-inline-end: 0;
	z-index: 5;
	display: grid;
	gap: 4px;
	min-width: 18rem;
	max-width: calc(100vw - 32px);
	margin-top: 8px;
	padding: 8px;
	background-color: var(--color-grey-700);
	border-radius: 8px;
	box-shadow: 0 8px 24px rgb(0 0 0 / 40%);

	@supports (corner-shape: squircle) {
		border-radius: 12px;
		corner-shape: var(--corner-shape);
	}
}

.panel a {
	display: block;
	padding: 6px 8px;
	font-size: 0.875rem;
	color: var(--color-grey-200);
	text-decoration: none;
	letter-spacing: 0.01em;
	border-radius: 4px;

	&:hover,
	&:focus-visible {
		background-color: var(--color-grey-600);
	}

	&[aria-current='page'] {
		color: #fff;
		font-weight: 600;
	}
}

.decades,
.years {
	margin: 0;
	padding: 0;
	list-style: none;
}

.decades > li > a[aria-expanded='true'] {
	background-color: var(--color-grey-600);
}

.years {
	display: grid;
	grid-template-columns: repeat(5, 1fr);
	gap: 2px;
	padding: 4px 8px 8px;

	a {
		text-align: center;
	}
}
</style>
