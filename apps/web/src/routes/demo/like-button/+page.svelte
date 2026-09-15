<script lang="ts">
import LikeButton from '$lib/components/like-button.svelte'

let holdDuration = $state(1000)
let haptics = $state(true)

let defaultUnliked = $state(false)
let defaultLiked = $state(true)
let logUnliked = $state(false)
let logLiked = $state(true)
let disabledLiked = $state(false)
</script>

<svelte:head>
	<title>Like button demo — Respawn</title>
</svelte:head>

<article class="page">
	<header class="intro">
		<h1 class="heading">Like button</h1>
		<p class="copy secondary">
			Liking needs a press-and-hold; unliking is a single tap. Works with a pointer or by holding
			Space or Enter.
		</p>
	</header>

	<section class="panel">
		<div class="control">
			<label class="label" for="hold-duration">Hold duration</label>
			<input
				id="hold-duration"
				type="range"
				min="250"
				max="3000"
				step="250"
				bind:value={holdDuration}
			/>
			<output class="readout" for="hold-duration">{holdDuration}ms</output>
		</div>
		<div class="control">
			<input id="haptics" type="checkbox" bind:checked={haptics} />
			<label class="label" for="haptics">Haptics</label>
		</div>
		<p class="copy sm secondary">
			Uses the Vibration API where available (Android); no-op elsewhere.
		</p>
	</section>

	<section class="demo">
		<h2 class="label">Default size</h2>
		<div class="row">
			<div class="actions">
				<LikeButton bind:liked={defaultUnliked} {holdDuration} {haptics} />
			</div>
			<p class="copy sm secondary">liked: {defaultUnliked}</p>
		</div>
		<div class="row">
			<div class="actions">
				<LikeButton bind:liked={defaultLiked} {holdDuration} {haptics} />
			</div>
			<p class="copy sm secondary">liked: {defaultLiked}</p>
		</div>
	</section>

	<section class="demo">
		<h2 class="label">Small size, with a label</h2>
		<div class="row">
			<div class="log">
				<span class="log-line">Played on Steam · 4.5★</span>
				<LikeButton
					bind:liked={logUnliked}
					size="small"
					label={logUnliked ? 'Liked' : 'Like'}
					{holdDuration}
					{haptics}
				/>
			</div>
			<p class="copy sm secondary">liked: {logUnliked}</p>
		</div>
		<div class="row">
			<div class="log">
				<span class="log-line">Completed on Switch · 5★</span>
				<LikeButton
					bind:liked={logLiked}
					size="small"
					label={logLiked ? 'Liked' : 'Like'}
					{holdDuration}
					{haptics}
				/>
			</div>
			<p class="copy sm secondary">liked: {logLiked}</p>
		</div>
	</section>

	<section class="demo">
		<h2 class="label">Disabled</h2>
		<div class="row">
			<div class="actions">
				<LikeButton bind:liked={disabledLiked} disabled {holdDuration} {haptics} />
			</div>
			<p class="copy sm secondary">liked: {disabledLiked}</p>
		</div>
	</section>
</article>

<style>
.intro {
	display: grid;
	gap: 8px;
}

.panel {
	display: grid;
	gap: 12px;
	justify-items: start;
	padding: 12px;
	background-color: var(--color-grey-800);
	border-radius: 8px;

	@supports (corner-shape: squircle) {
		border-radius: 16px;
		corner-shape: var(--corner-shape);
	}
}

.control {
	display: flex;
	gap: 12px;
	align-items: center;
}

.readout {
	min-inline-size: 5ch;
	font-size: 0.8125rem;
	font-variant-numeric: tabular-nums;
	color: var(--color-grey-400);
}

.demo {
	display: grid;
	gap: 12px;
	justify-items: start;
}

.row {
	display: flex;
	gap: 16px;
	align-items: center;
}

.actions {
	display: flex;
	gap: 8px;
	align-items: center;
	padding: 8px;
	background-color: var(--color-blue-100);
	border-radius: 8px;

	@supports (corner-shape: squircle) {
		border-radius: 16px;
		corner-shape: var(--corner-shape);
	}
}

.log {
	display: flex;
	gap: 12px;
	align-items: center;
	padding: 8px 8px 8px 12px;
	border: 1px solid var(--color-grey-700);
	border-radius: 8px;

	@supports (corner-shape: squircle) {
		border-radius: 16px;
		corner-shape: var(--corner-shape);
	}
}

.log-line {
	font-size: 0.8125rem;
	color: var(--color-grey-300);
	letter-spacing: 0.01em;
	text-box: trim-both cap alphabetic;
}
</style>
