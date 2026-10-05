<script lang="ts">
import { enhance } from '$app/forms'
import AvatarImage from '$lib/components/avatar-image.svelte'
import { Icon } from '@respawn-social/icons'
import type { ActionData, PageData } from './$types'
import SectionHeading from '$lib/components/section-heading.svelte'
import LikeButton from '$lib/components/like-button.svelte'
import RichText from '$lib/components/rich-text.svelte'
import GrainCard from '$lib/components/grain-card.svelte'
import RatingStars from '$lib/components/rating-stars.svelte'
import { activityVerb } from '$lib/log-form'
import { viewerState } from '$lib/viewer-state.svelte'

let { data, form }: { data: PageData; form: ActionData } = $props()

// Overridden by the like action; resets when navigating between logs (the
// component instance is reused).
let liked = $derived(data.viewerLiked)
let likeForm = $state<HTMLFormElement>()
/** Bumped per like submission, so only the latest response can revert the button. */
let likeSeq = 0
/** The log whose spoilers were revealed, so navigating to another hides them again. */
let revealedUri = $state<string | null>(null)

// `datePlayed` is midnight UTC for the chosen day, so format it in UTC too —
// and with a fixed locale, so server and client render the same string.
const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' })

let log = $derived(data.log)
let date = $derived(log.datePlayed ?? log.createdAt)
let edition = $derived([log.edition, ...(log.dlc ?? [])].filter(Boolean).join(', '))
// Author-supplied, so only ever an http(s) link.
let externalUrl = $derived(
	/^https?:\/\//i.test(log.review?.external?.uri ?? '') ? log.review?.external?.uri : null,
)

// Whole-review spoilers stay hidden unless the viewer wrote it or has completed the game.
let hideReview = $derived(
	Boolean(log.review?.containsSpoilers) &&
		revealedUri !== data.logUri &&
		!data.isSelf &&
		viewerState.game(log.game.igdbId).played !== 'completed',
)
</script>

<svelte:head>
	<title>{log.game.title} · log by @{data.displayName} · Respawn Social</title>
</svelte:head>

<article class="page">
	<header>
		<p class="person">
			<a class="profile-link" href="/{data.handle}/"
				><span class="avatar"><AvatarImage image={data.avatarUrl} /></span>
				<span>{data.displayName}</span></a
			> <span>{activityVerb(log)}</span>
		</p>
		<div class="title">
			<h1><a href="/game/{log.game.slug}/">{log.game.title}</a></h1>
			{#if edition}<p class="subtitle">{edition}</p>{/if}
			{#if log.platform}<p class="subtitle">{log.platform}</p>{/if}
		</div>
		{#if log.rating || log.liked}
			<div class="reactions">
				{#if log.rating}
					<RatingStars value={log.rating} />
				{/if}
				{#if log.liked}
					<div class="liked" role="img" aria-label="Liked">
						<Icon name="heart-solid"></Icon>
					</div>
				{/if}
			</div>
		{/if}
		<time datetime={date}>{dateFormat.format(new Date(date))}</time>
	</header>

	{#if log.review?.text}
		<section class="review">
			{#if hideReview}
				<p class="sub">This review contains spoilers.</p>
				<button type="button" onclick={() => (revealedUri = data.logUri)}>Show review</button>
			{:else}
				<RichText value={log.review} />
			{/if}
			{#if externalUrl}
				<p>
					<a href={externalUrl} rel="nofollow ugc noopener noreferrer" target="_blank"
						>Read the full review</a
					>
				</p>
			{/if}
		</section>
	{/if}

	<!-- Photos can spoil as much as text, so a hidden review hides them too. -->
	{#if data.photos.length && !hideReview}
		<section class="photos">
			<GrainCard photos={data.photos} />
		</section>
	{/if}

	{#if data.isLoggedIn && data.interactive}
		<form
			bind:this={likeForm}
			method="POST"
			action="?/like"
			use:enhance={({ formData }) => {
				const wanted = liked
				const seq = ++likeSeq
				formData.set('liked', String(wanted))
				// No `update()`: it would put a like failure into `form`, where the
				// comment box would show it as its own error.
				return ({ result }) => {
					// A later tap has superseded this one; its own result decides.
					if (seq !== likeSeq) return
					if (result.type !== 'success') liked = !wanted
				}
			}}
		>
			<LikeButton
				size="small"
				label={liked ? 'Liked' : 'Like'}
				bind:liked
				onchange={() => likeForm?.requestSubmit()}
			/>
		</form>
	{/if}

	{#if data.interactive}
		<section class="comments">
			<SectionHeading>Comments</SectionHeading>
			{#if data.commentsClosed}
				<p class="sub">The author has closed comments on this log.</p>
			{:else if data.isLoggedIn}
				{#if data.commentsLimited}
					<p class="sub">The author has limited who can comment on this log.</p>
				{/if}
				<form method="POST" action="?/comment" use:enhance>
					<textarea name="text" rows="3" maxlength="3000" placeholder="Add a comment"></textarea>
					{#if form?.error}<p class="error">{form.error}</p>{/if}
					{#if form?.commented}<p class="success">Comment posted.</p>{/if}
					<button class="button" type="submit"><span>Comment</span></button>
				</form>
			{:else}
				<p class="sub"><a href="/login/">Log in</a> to comment.</p>
			{/if}
		</section>
	{/if}
</article>

<style>
header {
	display: flex;
	flex-direction: column;
	gap: 24px;

	time {
		font-size: 0.875rem;
		color: var(--color-grey-500);
		text-box: trim-both cap alphabetic;
	}
}

.person {
	display: flex;
	gap: 0.2386em;
	font-size: 0.875rem;
	color: var(--color-grey-400);
	text-box: trim-both cap alphabetic;
	letter-spacing: 0.01em;

	span {
		text-box: trim-both cap alphabetic;
	}
}

.profile-link {
	display: inline-flex;
	gap: 0.2386em;
	color: var(--color-grey-300);
	text-decoration: none;
	text-box: trim-both cap alphabetic;

	span {
		font-weight: 600;
	}

	&:hover {
		color: var(--color-grey-100);
	}
}

.avatar {
	display: inline-flex;
	align-items: center;
	inline-size: 20px;
	block-size: 1cap;
}

.title {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;

	@media (width >= 632px) {
		gap: 1rem;
	}
}

h1 {
	font-size: 1.25rem;
	color: var(--color-grey-050);
	text-box: trim-both cap alphabetic;

	@media (width >= 632px) {
		font-size: 1.5rem;
	}

	a {
		text-decoration: none;

		&:hover {
			color: var(--color-grey-200);
		}
	}
}

.subtitle {
	color: var(--color-grey-400);
	text-box: trim-both cap alphabetic;

	@media (width >= 632px) {
		font-size: 1.125rem;
	}
}

.reactions {
	display: flex;
	gap: 8px;
}

.liked {
	display: flex;
	font-size: 1.125rem;
	color: var(--color-pink-500);
}

.comments {
	display: flex;
	flex-direction: column;
	gap: 16px;
}

textarea {
	inline-size: 100%;
	padding: var(--space-2) var(--space-3);
	font: inherit;
	color: var(--color-text);
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius);
}
</style>
