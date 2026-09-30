<script lang="ts">
import LogDialog from '$lib/components/log-dialog.svelte'
import {
	activitySentence,
	fromLogRecord,
	type CurrentPlayState,
	type LogGame,
	type LogResult,
} from '$lib/log-form'
import { serialize } from '$lib/richtext/facets'

type Mode = 'new' | 'edit'
type StateKey = 'none' | 'playing' | 'completed'

const STATES: Record<StateKey, { label: string; value: CurrentPlayState }> = {
	none: { label: 'Not played', value: { playing: false, played: null } },
	playing: { label: 'Playing', value: { playing: true, played: null } },
	completed: { label: 'Completed', value: { playing: false, played: 'completed' } },
}

const game: LogGame = {
	igdbId: 11737,
	slug: 'outer-wilds',
	title: 'Outer Wilds',
	year: 2019,
	coverUrl: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co65ac.jpg',
}

const platforms = ['PC (Microsoft Windows)', 'PlayStation 5', 'Xbox Series X|S', 'Nintendo Switch']
const editions = ['Standard Edition', 'Archaeologist Edition']
const dlcOptions = ['Echoes of the Eye']

const sample = fromLogRecord(
	{
		game: { igdbId: game.igdbId, slug: game.slug, title: game.title },
		platform: 'PC (Microsoft Windows)',
		edition: 'Archaeologist Edition',
		dlc: ['Echoes of the Eye'],
		datePlayed: '2026-09-20T00:00:00.000Z',
		finishedPlaying: 'completed',
		rating: 10,
		liked: true,
		review: serialize({
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [
						{ type: 'text', text: 'Finally rolled credits. Best moment: ' },
						{
							type: 'text',
							text: 'the sun explodes after 22 minutes',
							marks: [{ type: 'spoiler' }],
						},
						{ type: 'text', text: '.' },
					],
				},
			],
		}),
		createdAt: '2026-09-20T21:14:00.000Z',
	},
	{ allow: ['following'] },
)

let mode = $state<Mode>('new')
let stateKey = $state<StateKey>('none')
let suggestions = $state(true)
let saved = $state.raw<LogResult>()
let deleted = $state(false)

// oxlint-disable-next-line no-unassigned-vars
let dialog: LogDialog

function onsave(result: LogResult) {
	saved = result
	deleted = false
}

function ondelete() {
	saved = undefined
	deleted = true
}
</script>

<svelte:head>
	<title>Log dialog demo — Respawn</title>
</svelte:head>

<article class="page">
	<header class="intro">
		<h1 class="heading">Log dialog</h1>
		<p class="copy secondary">
			Adds or edits a <code>social.respawn.feed.log</code> record and its
			<code>social.respawn.feed.gate</code>. Progress fields describe what happened this session, so
			the feed line comes from the log alone.
		</p>
	</header>

	<section class="panel">
		<fieldset class="options">
			<legend class="label">Mode</legend>
			<label class="option">
				<input type="radio" name="mode" value="new" bind:group={mode} />
				New log
			</label>
			<label class="option">
				<input type="radio" name="mode" value="edit" bind:group={mode} />
				Edit a sample log
			</label>
		</fieldset>

		<fieldset class="options" disabled={mode === 'edit'}>
			<legend class="label">Current state</legend>
			{#each Object.entries(STATES) as [key, option] (key)}
				<label class="option">
					<input type="radio" name="state" value={key} bind:group={stateKey} />
					{option.label}
				</label>
			{/each}
		</fieldset>

		<label class="option">
			<input type="checkbox" bind:checked={suggestions} />
			Game has platform, edition and DLC data
		</label>

		<button type="button" class="button primary" onclick={() => dialog.open()}>
			<span>{mode === 'edit' ? 'Edit log' : 'Log a play'}</span>
		</button>
	</section>

	<LogDialog
		bind:this={dialog}
		{game}
		{onsave}
		{ondelete}
		value={mode === 'edit' ? sample : undefined}
		currentState={STATES[stateKey].value}
		platforms={suggestions ? platforms : []}
		editions={suggestions ? editions : []}
		dlcOptions={suggestions ? dlcOptions : []}
	/>

	<section class="demo">
		<h2 class="label">Feed line</h2>
		<p class="copy sm secondary">
			{#if saved}
				{activitySentence(saved.log, 'You')}
			{:else if deleted}
				Log deleted.
			{:else}
				Nothing saved yet.
			{/if}
		</p>
	</section>

	{#if saved}
		<section class="demo">
			<h2 class="label">Record</h2>
			<pre class="output">{JSON.stringify(saved.log, null, 2)}</pre>
		</section>

		<section class="demo">
			<h2 class="label">Gate</h2>
			<pre class="output">{saved.gate
					? JSON.stringify(saved.gate, null, 2)
					: 'None — everyone can comment.'}</pre>
		</section>
	{/if}
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
	gap: 24px;
	align-items: end;
	padding: 12px;
	background-color: var(--color-grey-800);
	border-radius: 8px;

	@supports (corner-shape: squircle) {
		border-radius: 16px;
		corner-shape: var(--corner-shape);
	}
}

.options {
	display: grid;
	gap: 8px;
	padding: 0;
	border: none;

	&:disabled {
		opacity: 0.5;
	}
}

.options legend {
	margin-block-end: 12px;
}

.option {
	display: flex;
	gap: 8px;
	align-items: center;
}

code {
	font-size: 0.875em;
	color: var(--color-grey-100);
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
</style>
