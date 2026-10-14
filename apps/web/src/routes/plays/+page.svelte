<script lang="ts">
import { enhance } from '$app/forms'
import CoverImage from '$lib/components/cover-image.svelte'
import type { DetectedPlay } from '$lib/types/game'
import type { ActionData, PageData } from './$types'

let { data, form }: { data: PageData; form: ActionData } = $props()

const dayFormat = new Intl.DateTimeFormat(undefined, {
	weekday: 'short',
	month: 'short',
	day: 'numeric',
})

function duration(minutes: number): string {
	if (minutes < 60) return `${minutes} min`
	const hours = Math.floor(minutes / 60)
	const rest = minutes % 60
	return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`
}

/**
 * The game page opens its log dialog prefilled from these. `at` rather than
 * the UTC `playedOn`, so the dialog can pick the date in the viewer's own time
 * zone.
 */
function logHref(play: DetectedPlay, slug: string): string {
	const params = new URLSearchParams({ play: play.id, at: play.lastPlayedAt, via: play.provider })
	return `/game/${slug}/?${params}`
}
</script>

<svelte:head>
	<title>New plays ▪ Respawn</title>
</svelte:head>

<article class="page">
	<header>
		<h1>New plays</h1>
		<p class="sub">
			Games you played on your <a href="/settings/connections/">connected accounts</a>. Log the ones
			worth logging; nothing is posted until you do.
		</p>
	</header>

	{#if form?.error}
		<p class="error" role="status">{form.error}</p>
	{/if}

	{#if data.plays === null}
		<p class="error">New plays are unavailable right now. Try again shortly.</p>
	{:else if data.plays.length === 0}
		<p class="sub">
			{#if data.hasAccounts}
				Nothing new. Plays show up here within about half an hour.
			{:else}
				<a href="/settings/connections/">Connect Steam</a> to see your plays here.
			{/if}
		</p>
	{:else}
		<ul class="plays">
			{#each data.plays as play (play.id)}
				<li class="play">
					<CoverImage image={play.title?.coverUrl} title={play.title?.displayName} />
					<div class="play-content">
						<span class="play-title"
							>{play.title?.displayName ?? play.externalName ?? 'Unknown game'}</span
						>
						<span class="sub">
							{duration(play.minutes)} · {dayFormat.format(new Date(play.lastPlayedAt))}
						</span>
						<div class="play-actions">
							{#if play.title}
								<a class="button primary" href={logHref(play, play.title.slug)}>
									<div>Log it</div>
								</a>
							{:else}
								<!-- No IGDB match for this Steam game: let the user find it. -->
								<a
									class="button primary"
									href="/search/{encodeURIComponent(play.externalName ?? '')}/"
								>
									<div>Find game</div>
								</a>
							{/if}
							<form method="POST" action="?/dismiss" use:enhance>
								<input type="hidden" name="id" value={play.id} />
								<button class="button" type="submit"><div>Dismiss</div></button>
							</form>
						</div>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</article>

<style>
.page {
	display: grid;
	gap: 32px;
	max-inline-size: 40rem;
	padding: 32px 0;
}

header {
	display: grid;
	gap: 16px;
}

h1 {
	font-size: 1.5rem;
	font-weight: 600;
	line-height: 1.2;
	text-box: trim-both cap alphabetic;
}

.sub {
	font-size: var(--text-sm);
	color: var(--color-grey-600);
}

.error {
	font-size: var(--text-sm);
	color: var(--color-pink-600);
}

.plays {
	display: grid;
	gap: 24px;
	padding: 0;
	margin: 0;
	list-style: none;
}

.play {
	display: grid;
	grid-template-columns: 72px 1fr;
	gap: 16px;
}

.play-content {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.play-title {
	font-size: 1.125rem;
	font-weight: 600;
	line-height: 1.2;
	text-box: trim-both cap alphabetic;
}

.play-actions {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}
</style>
