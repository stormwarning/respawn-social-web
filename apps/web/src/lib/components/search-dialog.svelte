<script lang="ts">
import { goto } from '$app/navigation'
import SiteHeader from '../../routes/site-header.svelte'
import CoverImage from './cover-image.svelte'

interface SearchResult {
	name: string
	slug: string
	year: number | null
	coverUrl: string | null
}

let { data } = $props()

// oxlint-disable-next-line no-unassigned-vars
let dialog: HTMLDialogElement
let q = $state('')
let results: SearchResult[] = $state.raw([])

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
		const data: { results: SearchResult[] } = await res.json()
		results = data.results
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') return
		throw error
	}
}

function toQuerySegment(value: string) {
	return encodeURIComponent(value.trim()).replace(/%20/g, '+')
}

function onsubmit(event: SubmitEvent) {
	event.preventDefault()
	const trimmed = q.trim()
	if (!trimmed) return
	dialog.close()
	goto(`/search/${toQuerySegment(trimmed)}/`)
}

/** Close when the backdrop (the dialog element itself) is clicked. */
function onclick(event: MouseEvent) {
	if (event.target === dialog) dialog.close()
}
</script>

<dialog bind:this={dialog} {onclick} onclose={reset}>
	<div class="dialog-inner">
		<SiteHeader {data} onsearch={() => dialog.close()} />
		<div class="dialog-content">
			<form class="form" action="/search/" method="get" {onsubmit}>
				<div class="input-wrapper">
					<label class="sr-only" for="search-dialog-q">Search:</label>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						id="search-dialog-q"
						class="input"
						type="text"
						name="q"
						inputmode="search"
						autocorrect="off"
						autocapitalize="off"
						autocomplete="off"
						autofocus
						placeholder="Find a game…"
						bind:value={q}
						{oninput}
					/>
				</div>
				<button class="submit" type="submit" aria-label="Search"
					><svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M21.78 20.72L17.44 16.38C18.7718 14.8066 19.5019 12.8114 19.5 10.75C19.5 5.925 15.575 2 10.75 2C5.925 2 2 5.925 2 10.75C2 15.575 5.925 19.5 10.75 19.5C12.8114 19.5019 14.8066 18.7718 16.38 17.44L20.72 21.78L21.78 20.72ZM3.5 10.75C3.5 6.75 6.75 3.5 10.75 3.5C14.75 3.5 18 6.75 18 10.75C18 14.75 14.75 18 10.75 18C6.75 18 3.5 14.75 3.5 10.75Z"
							fill="currentcolor"
						/>
					</svg>
				</button>
			</form>
			{#if results.length > 0}
				<ul class="results">
					{#each results as result, i (result.slug)}
						<li style:--i={i}>
							<a class="result" href="/game/{result.slug}/" onclick={() => dialog.close()}>
								<CoverImage image={result.coverUrl} />
								<span class="result-text">
									<span class="name">{result.name}</span>
									{#if result.year}
										<span class="year">{result.year}</span>
									{/if}
								</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</dialog>

<style>
dialog {
	width: 100vw;
	max-width: 100vw;
	height: min-content;
	margin-inline: 0;
	/*margin-top: calc(env(safe-area-inset-top) + 5rem);*/
	padding: 0;
	overflow: hidden;
	color: var(--color-text);
	background: var(--color-grey-800);
	border: 0;
	/*border-radius: 12px;
	corner-shape: var(--corner-shape);*/
	interpolate-size: allow-keywords;
	transition:
		height 200ms ease-out,
		opacity 200ms ease-out,
		display 200ms allow-discrete,
		overlay 200ms allow-discrete;
}

dialog:not([open]) {
	height: 0;
	opacity: 0;
}

@starting-style {
	dialog[open] {
		height: 0;
		opacity: 0;
	}
}

dialog::backdrop {
	top: 80px;
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
	max-width: 1024px;
	padding: 24px 48px 64px;
	margin: 0 auto;
}

.form {
	display: flex;
	/*gap: var(--space-2);*/
	transition:
		opacity 200ms ease-out 160ms,
		translate 200ms ease-out 160ms;
}

@starting-style {
	dialog[open] .form {
		opacity: 0;
		translate: 0 -4px;
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
	padding: 0 32px;
	margin-left: -32px;
	font-size: 1.375rem;
	color: var(--color-text);
	line-height: 1;
	background: transparent;
	border: none;
	border-radius: 8px;
	corner-shape: var(--corner-shape);
}

.input:focus-visible {
	outline: 0px solid var(--color-accent);
	outline-offset: 2px;
}

.submit {
	z-index: 2;
	display: flex;
	order: -1;
	padding: 4px;
	color: var(--color-grey-300);
	background-color: transparent;
	border: none;
	border-radius: 8px;
	corner-shape: var(--corner-shape);

	&:focus-visible {
		outline: 2px solid var(--color-accent);
		/*outline-offset: 2px;*/
	}
}

.results {
	display: flex;
	flex-direction: column;
	gap: var(--space-1);
	margin: 0;
	padding: 0;
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
	grid-template-columns: 42px 1fr;
	align-items: center;
	gap: var(--space-2);
	padding: var(--space-1) var(--space-2);
	text-decoration: none;
	border-radius: 8px;
	corner-shape: var(--corner-shape);
}

.result:hover {
	background: var(--color-grey-700);
}

.result-text {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	gap: 8px;
}

.name {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.year {
	color: var(--color-muted);
	font-size: var(--text-sm);
}
</style>
