<script lang="ts">
import type { ReplyRule } from '$lib/atproto/log'
import { REPLY_RULE_OPTIONS, type ReplyAllow } from '$lib/log-form'
import FieldLabel from './field-label.svelte'

interface Props {
	/** Anyone, no one, or the union of one or more rules. */
	allow?: ReplyAllow
	label?: string
}

let { allow = $bindable('anyone'), label = 'Who can comment' }: Props = $props()

const EXCLUSIVE_OPTIONS: Array<{ value: 'anyone' | 'nobody'; label: string }> = [
	{ value: 'anyone', label: 'Anyone' },
	{ value: 'nobody', label: 'Nobody' },
]

const uid = $props.id()
const triggerId = `${uid}--trigger`
const menuId = `${uid}--menu`
const rulesHeadingId = `${uid}--rules`
const anchor = `--replygate-menu-${uid}`

let trigger = $state<HTMLButtonElement>()
let menu = $state<HTMLDivElement>()
let menuOpen = $state(false)

let rules = $derived(Array.isArray(allow) ? allow : [])
let summary = $derived.by(() => {
	if (allow === 'anyone') return 'Anyone'
	if (allow === 'nobody') return 'Nobody'
	return REPLY_RULE_OPTIONS.filter((o) => rules.includes(o.value))
		.map((o) => o.label)
		.join(', ')
})

function choose(value: 'anyone' | 'nobody') {
	allow = value
	close()
}

/** Rules combine; unticking the last one goes back to anyone. */
function toggleRule(rule: ReplyRule) {
	const picked = new Set(rules)
	if (picked.has(rule)) picked.delete(rule)
	else picked.add(rule)
	const next = REPLY_RULE_OPTIONS.map((o) => o.value).filter((value) => picked.has(value))
	allow = next.length ? next : 'anyone'
}

function close() {
	if (menu?.matches(':popover-open')) menu.hidePopover()
	trigger?.focus()
}

function menuItems() {
	return Array.from(menu?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]') ?? [])
}

/**
 * The menu lives in the top layer, so it is anchored to its trigger with CSS
 * anchor positioning where supported and measured by hand elsewhere.
 */
function ontoggle(event: ToggleEvent) {
	menuOpen = event.newState === 'open'
	if (!menuOpen || !menu) return

	if (!CSS.supports('position-anchor', anchor) && trigger) {
		const rect = trigger.getBoundingClientRect()
		menu.style.insetBlockStart = `${rect.bottom + 4}px`
		menu.style.insetInlineStart = `${rect.left}px`
	}

	const items = menuItems()
	;(items.find((item) => item.ariaChecked === 'true') ?? items[0])?.focus()
}

function onkeydown(event: KeyboardEvent) {
	const items = menuItems()
	const index = items.indexOf(document.activeElement as HTMLButtonElement)
	let next: number | undefined

	switch (event.key) {
		case 'ArrowDown':
			next = (index + 1) % items.length
			break
		case 'ArrowUp':
			next = (index - 1 + items.length) % items.length
			break
		case 'Home':
			next = 0
			break
		case 'End':
			next = items.length - 1
			break
		case 'Tab':
			close()
			return
		default:
			return
	}

	event.preventDefault()
	items[next]?.focus()
}
</script>

<div class="replygate-menu">
	<FieldLabel for={triggerId} {label} />
	<button
		bind:this={trigger}
		id={triggerId}
		class="trigger"
		type="button"
		popovertarget={menuId}
		aria-haspopup="menu"
		aria-expanded={menuOpen}
		aria-controls={menuId}
		style:anchor-name={anchor}
	>
		<span class="summary">{summary}</span>
		<span class="caret" aria-hidden="true"></span>
	</button>
	<div
		bind:this={menu}
		id={menuId}
		class="menu"
		popover="auto"
		role="menu"
		tabindex="-1"
		aria-label={label}
		style:position-anchor={anchor}
		{ontoggle}
		{onkeydown}
	>
		<div role="group">
			{#each EXCLUSIVE_OPTIONS as option (option.value)}
				<button
					class="menu-item has-indicator"
					type="button"
					role="menuitemradio"
					aria-checked={allow === option.value}
					tabindex="-1"
					onclick={() => choose(option.value)}
				>
					<span class="radio" aria-hidden="true"></span>
					<span class="menu-item-label">{option.label}</span>
				</button>
			{/each}
		</div>
		<hr class="menu-divider" />
		<div role="group" aria-labelledby={rulesHeadingId}>
			<div id={rulesHeadingId} class="menu-heading" role="presentation">Or combine</div>
			{#each REPLY_RULE_OPTIONS as option (option.value)}
				<button
					class="menu-item has-indicator"
					type="button"
					role="menuitemcheckbox"
					aria-checked={rules.includes(option.value)}
					tabindex="-1"
					onclick={() => toggleRule(option.value)}
				>
					<span class="checkbox" aria-hidden="true"></span>
					<span class="menu-item-label">{option.label}</span>
				</button>
			{/each}
		</div>
	</div>
</div>

<style>
.replygate-menu {
	display: grid;
	gap: 8px;
	min-inline-size: 0;
}

/* Matches the text and select fields. */
.trigger {
	display: flex;
	gap: 8px;
	align-items: center;
	justify-content: space-between;
	min-inline-size: 0;
	padding: 8px 12px;
	font-family: inherit;
	font-size: 1.0625rem;
	line-height: normal;
	color: var(--color-text);
	text-align: start;
	cursor: pointer;
	background: var(--color-grey-600);
	border: none;
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

.summary {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

/* The select field's arrow. */
.caret {
	flex: none;
	inline-size: 10px;
	block-size: 6px;
	background: currentcolor;
	clip-path: polygon(0 0, 100% 0, 50% 100%);
}

/* The menu is the edition menu's, with exclusive radio items above combinable checkbox items. */
.menu {
	inset: auto;
	min-inline-size: 240px;
	padding: 4px;
	margin: 0;
	color: var(--color-grey-800);
	background-color: var(--color-grey-050);
	border: none;
	border-radius: 6px;
	box-shadow:
		0 0 0 1px rgb(0 0 0 / 8%),
		0 8px 24px rgb(0 0 0 / 25%);

	@supports (corner-shape: squircle) {
		border-radius: 12px;
		corner-shape: var(--corner-shape);
	}

	@supports (position-anchor: --a) {
		margin-block-start: 4px;
		position-area: block-end span-inline-end;
		position-try-fallbacks: flip-block, flip-inline;
	}
}

.menu-item {
	display: flex;
	flex-direction: column;
	gap: 8px;
	align-items: flex-start;
	inline-size: 100%;
	padding: 12px 8px;
	font: inherit;
	color: inherit;
	text-align: start;
	background-color: transparent;
	border: none;
	border-radius: 4px;

	@supports (corner-shape: squircle) {
		border-radius: 8px;
		corner-shape: var(--corner-shape);
	}

	&:hover,
	&:focus-visible {
		outline: none;
		background-color: var(--color-blue-100);
	}
}

.menu-item-label {
	font-size: 0.875rem;
	font-weight: 600;
	letter-spacing: 0.01em;
	text-box: trim-both cap alphabetic;

	.menu-item[aria-checked='true'] & {
		color: var(--color-blue-600);
	}
}

.menu-heading {
	padding: 10px 8px 6px;
	font-size: 0.75rem;
	font-weight: 600;
	color: var(--color-grey-500);
	text-transform: uppercase;
	letter-spacing: 0.06em;
}

.menu-divider {
	margin: 4px 0;
	border: none;
	border-block-start: 1px solid var(--color-grey-400);
}

/* Mixed radio and checkbox items, so each shows which kind it is. */
.has-indicator {
	flex-direction: row;
	gap: 10px;
	align-items: center;
}

.checkbox {
	display: grid;
	flex: none;
	place-items: center;
	inline-size: 16px;
	block-size: 16px;
	border: 1.5px solid var(--color-grey-500);
	border-radius: 4px;

	&::after {
		inline-size: 5px;
		block-size: 9px;
		content: '';
		border: solid transparent;
		border-width: 0 2px 2px 0;
		rotate: 45deg;
		translate: 0 -1px;
	}

	.menu-item[aria-checked='true'] & {
		background-color: var(--color-blue-600);
		border-color: var(--color-blue-600);

		&::after {
			border-color: var(--color-grey-050);
		}
	}
}

.radio {
	display: grid;
	flex: none;
	place-items: center;
	inline-size: 16px;
	block-size: 16px;
	border: 1.5px solid var(--color-grey-500);
	border-radius: 50%;

	&::after {
		inline-size: 8px;
		block-size: 8px;
		content: '';
		border-radius: 50%;
	}

	.menu-item[aria-checked='true'] & {
		border-color: var(--color-blue-600);

		&::after {
			background-color: var(--color-blue-600);
		}
	}
}
</style>
