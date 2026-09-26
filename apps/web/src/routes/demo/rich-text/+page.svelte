<script lang="ts">
import RichTextEditor from '$lib/components/rich-text-editor.svelte'
import RichText from '$lib/components/rich-text.svelte'
import { normalize, serialize } from '$lib/richtext/facets'
import type { RichDoc, RichTextValue } from '$lib/richtext/types'

type Mode = 'review' | 'list'

const MODES: Record<Mode, { label: string; maxGraphemes: number; spoilers: boolean }> = {
	review: { label: 'Log review', maxGraphemes: 10000, spoilers: true },
	list: { label: 'List description', maxGraphemes: 3000, spoilers: false },
}

const sample: RichDoc = {
	type: 'doc',
	content: [
		{
			type: 'paragraph',
			content: [
				{ type: 'text', text: 'Finally rolled credits on ' },
				{ type: 'text', text: 'Outer Wilds', marks: [{ type: 'italic' }] },
				{ type: 'text', text: '. It is ' },
				{ type: 'text', text: 'the', marks: [{ type: 'bold' }] },
				{ type: 'text', text: ' game about curiosity. 🪐' },
			],
		},
		{
			type: 'bulletList',
			content: [
				{
					type: 'listItem',
					content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Go in blind' }] }],
				},
				{
					type: 'listItem',
					content: [
						{
							type: 'paragraph',
							content: [
								{ type: 'text', text: 'Play the ' },
								{
									type: 'text',
									text: 'Echoes of the Eye',
									marks: [{ type: 'link', attrs: { href: 'https://www.mobiusdigitalgames.com/' } }],
								},
								{ type: 'text', text: ' DLC' },
							],
						},
					],
				},
			],
		},
		{
			type: 'blockquote',
			content: [
				{
					type: 'paragraph',
					content: [
						{
							type: 'text',
							text: 'It’s the end of the universe, but it’s not the end of everything.',
						},
					],
				},
			],
		},
		{
			type: 'paragraph',
			content: [
				{ type: 'text', text: 'Best moment: ' },
				{ type: 'text', text: 'the sun explodes after 22 minutes', marks: [{ type: 'spoiler' }] },
				{ type: 'text', text: '.' },
			],
		},
	],
}

let mode = $state<Mode>('review')
let value = $state.raw<RichTextValue>({ text: '' })
let importDraft = $state('')
let importError = $state('')

let config = $derived(MODES[mode])
let record = $derived(JSON.stringify(value, null, 2))
// Parsing and re-serializing should land on the same record (spoilers are
// re-scrambled, so compare the original text).
let roundTrips = $derived.by(() => {
	const again = normalize(value)
	return (
		(again.textWithSpoilers ?? again.text) === (value.textWithSpoilers ?? value.text) &&
		JSON.stringify(again.facets ?? []) === JSON.stringify(value.facets ?? [])
	)
})

function loadSample() {
	value = serialize(sample)
}

function loadImport() {
	try {
		const parsed = JSON.parse(importDraft)
		if (typeof parsed?.text !== 'string') throw new Error('Expected an object with a `text` string')
		value = parsed
		importError = ''
	} catch (error) {
		importError = error instanceof Error ? error.message : String(error)
	}
}
</script>

<svelte:head>
	<title>Rich text demo — Respawn</title>
</svelte:head>

<article class="page">
	<header class="intro">
		<h1 class="heading">Rich text</h1>
		<p class="copy secondary">
			A WYSIWYG editor that takes Markdown shortcuts as you type and saves plain text plus
			<code>social.respawn.richtext.facet</code> annotations.
		</p>
	</header>

	<section class="panel">
		<fieldset class="modes">
			<legend class="label">Field</legend>
			{#each Object.entries(MODES) as [key, option] (key)}
				<label class="option">
					<input type="radio" name="mode" value={key} bind:group={mode} />
					{option.label}
					<span class="secondary">
						· {option.maxGraphemes.toLocaleString()} characters{option.spoilers ? ', spoilers' : ''}
					</span>
				</label>
			{/each}
		</fieldset>
		<div class="actions">
			<button type="button" class="button small" onclick={loadSample}
				><span>Load sample</span></button
			>
			<button type="button" class="button small" onclick={() => (value = { text: '' })}>
				<span>Clear</span>
			</button>
		</div>
	</section>

	{#key mode}
		<RichTextEditor
			bind:value
			label={config.label}
			description="Bold, italic, links, lists and quotes. Paste or type Markdown."
			placeholder="What did you think?"
			maxGraphemes={config.maxGraphemes}
			spoilers={config.spoilers}
		/>
	{/key}

	<section class="demo">
		<h2 class="label">Shortcuts</h2>
		<table class="shortcuts copy sm">
			<thead>
				<tr><th>Format</th><th>Type</th><th>Keys</th></tr>
			</thead>
			<tbody>
				<tr><td>Bold</td><td><code>**text**</code> or <code>__text__</code></td><td>⌘B</td></tr>
				<tr><td>Italic</td><td><code>*text*</code> or <code>_text_</code></td><td>⌘I</td></tr>
				<tr><td>Link</td><td><code>[text](https://…)</code> or a bare URL</td><td>⌘K</td></tr>
				<tr><td>Spoiler</td><td><code>||text||</code></td><td>⌘⇧S</td></tr>
				<tr><td>Bulleted list</td><td><code>- </code> at line start</td><td>⌘⇧8</td></tr>
				<tr><td>Numbered list</td><td><code>1. </code> at line start</td><td>⌘⇧7</td></tr>
				<tr><td>Quote</td><td><code>&gt; </code> at line start</td><td>⌘⇧B</td></tr>
				<tr><td>Line break</td><td></td><td>⇧Enter</td></tr>
			</tbody>
		</table>
	</section>

	<section class="demo">
		<h2 class="label">Rendered</h2>
		<div class="preview">
			{#if value.text}
				<RichText {value} />
			{:else}
				<p class="copy sm secondary">Nothing yet.</p>
			{/if}
		</div>
	</section>

	<section class="demo">
		<h2 class="label">
			Record
			<span class={['status', roundTrips ? 'ok' : 'bad']}>
				{roundTrips ? '✓ round-trips' : '✗ does not round-trip'}
			</span>
		</h2>
		<pre class="output">{record}</pre>
	</section>

	<section class="demo">
		<h2 class="label">Load a record</h2>
		<p class="copy sm secondary">
			Paste <code>{'{ text, textWithSpoilers?, facets? }'}</code> JSON (e.g. a
			<code>review</code> from a PDS) to load it into the editor.
		</p>
		<textarea
			class="import"
			rows="6"
			spellcheck="false"
			aria-label="Record JSON"
			bind:value={importDraft}
		></textarea>
		<div class="actions">
			<button type="button" class="button small" onclick={loadImport}><span>Load</span></button>
			{#if importError}<p class="copy sm error">{importError}</p>{/if}
		</div>
	</section>
</article>

<style>
.intro,
.demo {
	display: grid;
	gap: 12px;
}

.panel {
	display: flex;
	flex-wrap: wrap;
	gap: 16px;
	align-items: end;
	justify-content: space-between;
	padding: 12px;
	background-color: var(--color-grey-800);
	border-radius: 8px;

	@supports (corner-shape: squircle) {
		border-radius: 16px;
		corner-shape: var(--corner-shape);
	}
}

.modes {
	display: grid;
	gap: 8px;
	padding: 0;
	border: none;
}

.modes legend {
	margin-block-end: 12px;
}

.option {
	display: flex;
	gap: 8px;
	align-items: center;
}

.secondary {
	color: var(--color-grey-400);
}

.actions {
	display: flex;
	gap: 8px;
	align-items: center;
}

code {
	font-size: 0.875em;
	color: var(--color-grey-100);
}

.shortcuts {
	border-collapse: collapse;

	th,
	td {
		padding: 6px 16px 6px 0;
		text-align: start;
		border-block-end: 1px solid var(--color-grey-800);
	}

	th {
		font-weight: 600;
		color: var(--color-grey-400);
	}

	td:last-child {
		font-variant-numeric: tabular-nums;
		color: var(--color-grey-400);
	}
}

.preview {
	padding: 16px;
	border: 1px solid var(--color-grey-700);
	border-radius: 8px;

	@supports (corner-shape: squircle) {
		border-radius: 16px;
		corner-shape: var(--corner-shape);
	}
}

.status {
	margin-inline-start: 8px;
	font-weight: 400;

	&.ok {
		color: var(--color-positive);
	}

	&.bad {
		color: var(--color-critical);
	}
}

.output {
	max-block-size: 24rem;
	padding: 12px;
	overflow: auto;
	font-size: 0.8125rem;
	color: var(--color-grey-300);
	background: var(--color-grey-950);
	border-radius: 8px;
}

.import {
	padding: 8px 12px;
	font-family: ui-monospace, monospace;
	font-size: 1rem;
	color: var(--color-text);
	background: var(--color-grey-800);
	border: 1px solid var(--color-grey-700);
	border-radius: 8px;
}

.error {
	color: var(--color-critical);
}
</style>
