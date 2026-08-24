<script lang="ts">
import type { Snippet } from 'svelte'
import AvatarImage from './avatar-image.svelte'

interface Props {
	children: Snippet
	/** Hidden when the row is about the current user — their own avatar adds nothing. */
	showAvatar?: boolean
	avatar?: string | null
	/** ISO timestamp from the record; omitted for optimistic rows. */
	createdAt?: string
}

let { children, showAvatar = true, avatar = null, createdAt }: Props = $props()

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
// Feed ages are approximate by design, so months and years use flat averages
// rather than walking the calendar.
const MONTH = 30 * DAY
const YEAR = 365 * DAY

/** Compact feed age: "just now", "5m", "3h", "2d", "7mo", "1y". */
function relativeAge(iso: string): string {
	const elapsed = Date.now() - new Date(iso).getTime()
	if (elapsed < MINUTE) return 'just now'
	if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`
	if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`
	if (elapsed < MONTH) return `${Math.floor(elapsed / DAY)}d`
	if (elapsed < YEAR) return `${Math.floor(elapsed / MONTH)}mo`
	return `${Math.floor(elapsed / YEAR)}y`
}
</script>

<div class="activity {showAvatar ? 'show-avatar' : ''}">
	{#if showAvatar}
		<div class="activity-avatar">
			<AvatarImage image={avatar} />
		</div>
	{/if}

	{@render children()}

	<div class="activity-timestamp">
		{#if createdAt}
			<time datetime={createdAt} title={new Date(createdAt).toLocaleString()}>
				{relativeAge(createdAt)}
			</time>
		{/if}
	</div>
</div>

<style>
.activity {
	display: grid;
	grid-template-columns: 1fr auto;
	gap: 4px;
	padding: 8px 0;
	font-size: 0.875rem;
	color: var(--color-grey-400);
	letter-spacing: 0.02em;

	&.show-avatar {
		grid-template-columns: 1.25rem 1fr auto;
	}

	:global(> div) {
		text-box: trim-both cap alphabetic;
	}
}

.activity-avatar {
	display: flex;
	align-items: center;
	height: 1cap;

	:global(> div) {
		height: 1.25rem;
	}
}

:global(.profile-link) {
	font-weight: 600;
	color: var(--color-grey-300);
	text-decoration: none;

	&:hover {
		color: var(--color-grey-100);
	}
}

:global(.game-link) {
	color: var(--color-grey-050);
	text-decoration: none;

	&:hover {
		color: var(--color-grey-200);
	}
}

:global(.backlog-link) {
	color: var(--color-grey-300);
	text-decoration: none;

	&:hover {
		color: var(--color-grey-100);
	}
}

.activity-timestamp {
	display: flex;
	align-items: center;
	height: 1cap;
	font-size: 0.75rem;
	color: var(--color-grey-400);
	letter-spacing: 0.02em;
}
</style>
