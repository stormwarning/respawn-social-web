<script lang="ts" module>
export interface GameSearchResult {
	igdbId: number
	name: string
	slug: string
	year: number | null
	coverUrl: string | null
	rawCoverUrl: string | null
}
</script>

<script lang="ts">
import CoverImage from './cover-image.svelte'

interface Props {
	/** Called with the picked game just before the dialog closes. */
	onselect: (game: GameSearchResult) => void
	/** IGDB ids already picked; those results are shown but not selectable. */
	excludeIds?: number[]
	title?: string
}

let { onselect, excludeIds = [], title = 'Add a favourite' }: Props = $props()

// oxlint-disable-next-line no-unassigned-vars
let dialog: HTMLDialogElement
let q = $state('')
let results: GameSearchResult[] = $state.raw([])

let timer: ReturnType<typeof setTimeout> | undefined
let controller: AbortController | undefined

export function open() {
	dialog.showModal()
}

function reset() {
	clearTimeout(timer)
	controller?.abort()
	q = ''
	results = []
}

function oninput() {
	clearTimeout(timer)
	const query = q.trim()
	if (query.length < 2) {
		controller?.abort()
		results = []
		return
	}
	timer = setTimeout(() => search(query), 300)
}

async function search(query: string) {
	controller?.abort()
	controller = new AbortController()
	try {
		const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
			signal: controller.signal,
		})
		if (!res.ok) return
		const data: { results: GameSearchResult[] } = await res.json()
		results = data.results
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') return
		throw error
	}
}

function select(result: GameSearchResult) {
	onselect(result)
	dialog.close()
}

/**
 * The dialog is rendered inside the settings form, so Enter here would submit
 * that form. Take the key instead: it picks the first selectable result.
 */
function onkeydown(event: KeyboardEvent) {
	if (event.key !== 'Enter') return
	event.preventDefault()
	const first = results.find((result) => !excludeIds.includes(result.igdbId))
	if (first) select(first)
}

/** Close when the backdrop (the dialog element itself) is clicked. */
function onclick(event: MouseEvent) {
	if (event.target === dialog) dialog.close()
}
</script>

<dialog bind:this={dialog} {onclick} onclose={reset} aria-label={title}>
	<div class="dialog-content">
		<div class="dialog-header">
			<h2>{title}</h2>
			<button class="close" type="button" onclick={() => dialog.close()} aria-label="Close">
				<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
					<path
						d="M18.3 5.71 12 12.01l-6.3-6.3-1.41 1.41 6.3 6.3-6.3 6.29 1.41 1.42 6.3-6.3 6.3 6.3 1.41-1.42-6.3-6.29 6.3-6.3z"
						fill="currentcolor"
					/>
				</svg>
			</button>
		</div>

		<div class="input-wrapper">
			<label class="sr-only" for="game-picker-q">Search for a game:</label>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				id="game-picker-q"
				class="input"
				type="text"
				inputmode="search"
				autocorrect="off"
				autocapitalize="off"
				autocomplete="off"
				autofocus
				placeholder="Find a game…"
				bind:value={q}
				{oninput}
				{onkeydown}
			/>
		</div>

		{#if results.length > 0}
			<ul class="results">
				{#each results as result, i (result.igdbId)}
					{@const added = excludeIds.includes(result.igdbId)}
					<li style:--i={i}>
						<button class="result" type="button" disabled={added} onclick={() => select(result)}>
							<CoverImage image={result.coverUrl} />
							<span class="result-text">
								<span class="name">{result.name}</span>
								{#if result.year}
									<span class="year">{result.year}</span>
								{/if}
							</span>
							{#if added}
								<span class="added">Added</span>
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</dialog>

<style>
dialog {
	width: min(32rem, 100vw - 2rem);
	max-width: none;
	padding: 0;
	color: var(--color-text);
	background: var(--color-grey-800);
	border: 1px solid var(--color-border);
	border-radius: 8px;
	opacity: 1;
	transition:
		opacity 200ms ease-out,
		translate 200ms ease-out,
		display 200ms allow-discrete,
		overlay 200ms allow-discrete;

	@supports (corner-shape: squircle) {
		border-radius: 16px;
		corner-shape: var(--corner-shape);
	}
}

dialog:not([open]) {
	opacity: 0;
	translate: 0 -4px;
}

@starting-style {
	dialog[open] {
		opacity: 0;
		translate: 0 -4px;
	}
}

dialog::backdrop {
	background: rgb(0 0 0 / 40%);
	opacity: 0;
	transition:
		opacity 200ms ease-out,
		display 200ms allow-discrete,
		overlay 200ms allow-discrete;
}

dialog[open]::backdrop {
	opacity: 1;
}

@starting-style {
	dialog[open]::backdrop {
		opacity: 0;
	}
}

.dialog-content {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
	padding: 16px;
}

.dialog-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--space-2);

	h2 {
		font-size: var(--text-base);
		font-weight: 600;
	}
}

.close {
	display: flex;
	padding: 4px;
	color: var(--color-grey-300);
	background: transparent;
	border: none;
	border-radius: 4px;

	@supports (corner-shape: squircle) {
		border-radius: 8px;
		corner-shape: var(--corner-shape);
	}

	&:focus-visible {
		outline: 2px solid var(--color-accent);
	}
}

.input-wrapper {
	display: flex;
	width: 100%;
}

.sr-only {
	position: absolute;
	width: 1px;
	height: 1px;
	overflow: hidden;
	clip-path: inset(50%);
	white-space: nowrap;
}

.input {
	flex: 1;
	min-width: 0;
	padding: 8px 12px;
	font: inherit;
	color: var(--color-text);
	background: var(--color-grey-900);
	border: 1px solid var(--color-border);
	border-radius: 4px;

	@supports (corner-shape: squircle) {
		border-radius: 8px;
		corner-shape: var(--corner-shape);
	}

	&:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
}

.results {
	display: flex;
	flex-direction: column;
	gap: var(--space-1);
	max-height: 50vh;
	padding: 0;
	margin: 0;
	overflow-y: auto;
	list-style: none;
}

.results li {
	transition: opacity 200ms ease-out;
	transition-delay: calc(var(--i) * 40ms);
}

@starting-style {
	.results li {
		opacity: 0;
	}
}

.result {
	display: grid;
	grid-template-columns: 42px 1fr auto;
	align-items: center;
	gap: var(--space-2);
	width: 100%;
	padding: var(--space-1) var(--space-2);
	font: inherit;
	color: inherit;
	text-align: left;
	background: transparent;
	border: none;
	border-radius: 6px;

	@supports (corner-shape: squircle) {
		border-radius: 12px;
		corner-shape: var(--corner-shape);
	}

	&:hover:not(:disabled) {
		background: var(--color-grey-700);
	}

	&:disabled {
		opacity: 0.5;
	}

	&:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: -2px;
	}
}

.result-text {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	gap: 8px;
	min-width: 0;
}

.name {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.year,
.added {
	font-size: var(--text-sm);
	color: var(--color-muted);
}
</style>
