<script lang="ts">
import { onDestroy } from 'svelte'
import IconHeartSolid from './icons/icon-heart-solid.svelte'

let {
	liked = $bindable(false),
	size = 'default',
	label,
	disabled = false,
	holdDuration = 1000,
	haptics = true,
	onchange,
}: {
	liked?: boolean
	size?: 'default' | 'small'
	/** Visible text beside the heart; omit for an icon-only button. */
	label?: string
	disabled?: boolean
	/** How long an unliked button must be held before the like commits, in ms. */
	holdDuration?: number
	/** Vibrate on the beats, where the platform supports it. */
	haptics?: boolean
	onchange?: (liked: boolean) => void
} = $props()

/** The squash before the thump, in ms. */
const BEAT1 = 120
/** The thump, and the window the blast and particles play in, in ms. */
const BEAT2 = 560

const PARTICLES = Array.from({ length: 9 }, (_, i) => ({
	i,
	angle: i * 40,
	far: i % 2 === 0,
	purple: i % 3 === 1,
}))

let phase = $state<'idle' | 'holding' | 'beat1' | 'beat2'>('idle')
let button = $state<HTMLButtonElement>()

let holdTimer: ReturnType<typeof setTimeout> | undefined
let beatTimer: ReturnType<typeof setTimeout> | undefined
/** Set when a pointer hold starts, so the click that follows the press cannot toggle too. */
let swallowClick = false
/** Set by a Space/Enter press, so a release this button never saw does nothing. */
let keyArmed = false

/**
 * The ring sits around the heart (`--icon-size` plus a few px of breathing room)
 * and its viewBox matches its rendered box 1:1, so `stroke-width: 2` lands on two
 * real pixels and the dash length is in CSS pixels.
 */
let ringBox = $derived(size === 'small' ? 30 : 44)
let ringRadius = $derived(ringBox / 2 - 1)
let ringLength = $derived(2 * Math.PI * ringRadius)

function clearTimers() {
	clearTimeout(holdTimer)
	clearTimeout(beatTimer)
	holdTimer = undefined
	beatTimer = undefined
}

function reset() {
	clearTimers()
	phase = 'idle'
}

function commit(next: boolean) {
	liked = next
	onchange?.(next)
}

/** Progressive enhancement: silently does nothing where the Vibration API is missing. */
function vibrate(pattern: VibratePattern) {
	if (!haptics) return
	if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern)
}

/** The like lands here, from a committed hold or from a key release. */
function trigger() {
	clearTimers()
	commit(true)
	phase = 'beat1'
	// One pattern covers both beats: a tick, the gap, then the thump.
	vibrate([20, BEAT1 - 20, 50])
	beatTimer = setTimeout(() => {
		phase = 'beat2'
		beatTimer = setTimeout(reset, BEAT2)
	}, BEAT1)
}

function unlike() {
	reset()
	commit(false)
	vibrate(10)
}

/** Pointer only — the keyboard goes straight to `trigger`. */
function startHold() {
	clearTimers()
	phase = 'holding'
	holdTimer = setTimeout(trigger, holdDuration)
}

function cancelHold() {
	if (phase !== 'holding') return
	reset()
}

function onpointerdown(event: PointerEvent) {
	swallowClick = false
	if (disabled || event.button !== 0 || liked) return
	button?.setPointerCapture(event.pointerId)
	swallowClick = true
	startHold()
}

/**
 * Both keys are cancelled so the browser cannot synthesise a click, which leaves
 * `onkeyup` as the single keyboard path in either direction.
 */
function onkeydown(event: KeyboardEvent) {
	if (event.key !== ' ' && event.key !== 'Enter') return
	event.preventDefault()
	if (!event.repeat) keyArmed = true
}

/** Committing on release is what keeps a slightly long press from firing twice. */
function onkeyup(event: KeyboardEvent) {
	if (event.key !== ' ' && event.key !== 'Enter') return
	if (!keyArmed || disabled) return
	keyArmed = false
	if (liked) unlike()
	else trigger()
}

function onblur() {
	keyArmed = false
	cancelHold()
}

/** Pointer unlike only: liking is driven by the hold, and the keyboard by `onkeyup`. */
function onclick() {
	if (swallowClick) {
		swallowClick = false
		return
	}
	if (disabled || !liked) return
	unlike()
}

// A parent can disable the button mid-hold; drop the in-flight hold when it does.
$effect(() => {
	if (disabled) reset()
})

onDestroy(clearTimers)
</script>

<button
	bind:this={button}
	class={['like-button', size]}
	type="button"
	{disabled}
	data-state={phase}
	aria-label={label ? undefined : 'Like'}
	aria-pressed={liked}
	style="

--ring-length: {ringLength}; --hold-duration: {holdDuration}ms; --beat-2: {BEAT2}ms"
	{onpointerdown}
	onpointerup={cancelHold}
	onpointercancel={cancelHold}
	onpointerleave={cancelHold}
	onlostpointercapture={cancelHold}
	oncontextmenu={(event) => event.preventDefault()}
	{onkeydown}
	{onkeyup}
	{onblur}
	{onclick}
>
	<span class="visual">
		<svg
			class="ring"
			viewBox="0 0 {ringBox} {ringBox}"
			width={ringBox}
			height={ringBox}
			aria-hidden="true"
		>
			<circle class="ring-track" cx={ringBox / 2} cy={ringBox / 2} r={ringRadius} />
			<circle
				class="ring-progress"
				cx={ringBox / 2}
				cy={ringBox / 2}
				r={ringRadius}
				stroke-dasharray={ringLength}
			/>
		</svg>
		<span class="heart">
			<span class="heart-base"><IconHeartSolid /></span>
			<span class="heart-solid"><IconHeartSolid /></span>
		</span>
		{#if phase === 'beat2'}
			<span class="burst" aria-hidden="true">
				<span class="blast"></span>
				{#each PARTICLES as particle (particle.i)}
					<span
						class={['particle', particle.far && 'far', particle.purple && 'purple']}
						style="

--angle: {particle.angle}deg"
					></span>
				{/each}
			</span>
		{/if}
	</span>
	{#if label}<span class="label">{label}</span>{/if}
</button>

<style>
.like-button {
	--icon-size: 32px;
	--burst-distance: 26px;
	--particle-size: 5px;

	display: flex;
	gap: 6px;
	align-items: center;
	padding: 4px;
	color: var(--color-grey-500);
	touch-action: manipulation;
	user-select: none;
	background-color: transparent;
	border: none;
	border-radius: 4px;
	-webkit-tap-highlight-color: transparent;
	-webkit-touch-callout: none;

	@supports (corner-shape: squircle) {
		border-radius: 8px;
		corner-shape: var(--corner-shape);
	}

	@media (hover: hover) and (pointer: fine) {
		&[data-state='idle']:hover:not(:disabled) .heart {
			scale: 1.1;
		}
	}

	&:focus-visible {
		outline: 2px solid var(--color-blue-500);
		outline-offset: 2px;
	}

	&:disabled {
		cursor: default;
		opacity: 0.4;
	}

	&.small {
		--icon-size: 20px;
		--burst-distance: 18px;
		--particle-size: 4px;

		gap: 5px;
		padding: 4px 6px;
	}
}

.label {
	font-family: var(--font-ui);
	font-size: 0.8125rem;
	font-weight: 600;
	letter-spacing: 0.01em;
	text-box: trim-both cap alphabetic;
}

.visual {
	display: grid;
	place-items: center;
	inline-size: var(--icon-size);
	block-size: var(--icon-size);
}

.ring {
	grid-area: 1 / 1;
	opacity: 0;
	rotate: -90deg;
	transition: opacity 120ms ease-out;

	.like-button[data-state='holding'] & {
		opacity: 1;
		transition-duration: 60ms;
	}
}

.ring-track,
.ring-progress {
	fill: none;
	stroke-width: 2;
}

.ring-track {
	opacity: 0.25;
	stroke: var(--color-grey-300);
}

.ring-progress {
	stroke: var(--color-pink-600);
	stroke-linecap: round;
	stroke-dashoffset: var(--ring-length);

	/* An early release snaps the ring back rather than unwinding it. */
	transition: stroke-dashoffset 120ms ease-out;

	.like-button[data-state='holding'] & {
		stroke-dashoffset: 0;
		transition-timing-function: linear;
		transition-duration: var(--hold-duration);
	}
}

.heart {
	display: grid;
	grid-area: 1 / 1;
	place-items: center;
	transition: scale 150ms ease-out;

	.like-button[data-state='holding'] & {
		scale: 0.8;
		transition-duration: var(--hold-duration);
	}
}

.heart-base,
.heart-solid {
	display: flex;
	grid-area: 1 / 1;

	:global(> svg) {
		inline-size: var(--icon-size);
		block-size: var(--icon-size);
		fill: currentcolor;
	}
}

.heart-solid {
	color: var(--color-pink-600);
	scale: 0;
	transition: scale 160ms ease-in;

	.like-button[aria-pressed='true'] & {
		scale: 1;
	}
}

.burst {
	display: none;
}

@media (prefers-reduced-motion: no-preference) {
	.burst {
		display: grid;
		grid-area: 1 / 1;
		place-items: center;
		inline-size: 100%;
		block-size: 100%;
		pointer-events: none;
	}

	.blast {
		grid-area: 1 / 1;
		inline-size: 100%;
		block-size: 100%;
		border: 2px solid var(--color-pink-600);
		border-radius: 50%;
		animation: blast 500ms ease-out both;
	}

	.particle {
		--distance: var(--burst-distance);

		grid-area: 1 / 1;
		inline-size: var(--particle-size);
		block-size: var(--particle-size);
		background-color: var(--color-pink-600);
		border-radius: 50%;
		animation: particle var(--beat-2) cubic-bezier(0.2, 0.8, 0.3, 1) both;

		&.far {
			--distance: calc(var(--burst-distance) * 1.45);
		}

		&.purple {
			background-color: var(--color-purple-500);
		}
	}

	/* The squash is instant so the release reads as a single sharp "bum". */
	.like-button[data-state='beat1'] .heart {
		scale: 0.65;
		transition: none;
	}

	.like-button[data-state='beat1'] .heart-solid {
		scale: 0;
		transition: none;
	}

	.like-button[data-state='beat2'] .heart {
		animation: heart-beat var(--beat-2) both;
	}

	.like-button[data-state='beat2'] .heart-solid {
		animation: fill-pop var(--beat-2) both;
	}
}

@keyframes heart-beat {
	0% {
		scale: 0.65;
		animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	45% {
		scale: 1.18;
		animation-timing-function: ease-out;
	}

	100% {
		scale: 1;
	}
}

@keyframes fill-pop {
	0% {
		color: var(--color-pink-600);
		filter: drop-shadow(0 0 0 rgb(0 0 0 / 0%));
		scale: 0;
		animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	45% {
		color: color-mix(in oklch, var(--color-pink-600) 70%, #fff);
		filter: drop-shadow(0 0 6px color-mix(in oklch, var(--color-pink-600) 80%, #fff));
		scale: 1.12;
		animation-timing-function: ease-out;
	}

	100% {
		color: var(--color-pink-600);
		filter: drop-shadow(0 0 0 rgb(0 0 0 / 0%));
		scale: 1;
	}
}

@keyframes blast {
	from {
		opacity: 0.8;
		scale: 0.4;
	}

	to {
		opacity: 0;
		scale: 2;
	}
}

@keyframes particle {
	from {
		opacity: 1;
		transform: rotate(var(--angle)) translateY(-4px) scale(1);
	}

	to {
		opacity: 0;
		transform: rotate(var(--angle)) translateY(calc(-1 * var(--distance))) scale(0);
	}
}
</style>
