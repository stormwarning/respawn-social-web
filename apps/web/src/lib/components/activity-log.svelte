<script lang="ts">
import { page } from '$app/state'
import { Icon } from '@respawn-social/icons'
import { hasReview, type RespawnLogRecord } from '$lib/atproto/log'
import { activityVerb } from '$lib/log-form'
import ActivityBase from './activity-base.svelte'
import CoverImage from './cover-image.svelte'
import RatingStars from './rating-stars.svelte'

interface LogActor {
	did: string
	name: string
	url: string
	avatar?: string | null
}

interface Props {
	actor: LogActor
	log: { url: string; record: RespawnLogRecord; coverUrl: string | null; commentCount: number }
	createdAt?: string
}

let { actor, log, createdAt }: Props = $props()

let isViewer = $derived(actor.did === page.data.user?.did)
let isReview = $derived(hasReview(log.record))
let mediaCount = $derived(log.record.media?.length ?? 0)
</script>

<ActivityBase showAvatar={!isViewer} avatar={actor.avatar} {createdAt}>
	<div class="log-activity">
		<span>
			{#if isViewer}
				<span>You</span>
			{:else}
				<a class="profile-link" href={actor.url}>{actor.name}</a>
			{/if}
			<a class="activity-link" href={log.url}>
				<span class="activity-verb">{activityVerb(log.record)}</span>
				{#if !isReview}
					<span class="activity-game">{log.record.game.title}</span>
				{/if}
			</a>
			{#if log.record.rating && !isReview}
				<RatingStars value={log.record.rating} isInline size={12} />
			{/if}
		</span>
		{#if isReview}
			<div class="log-review">
				<CoverImage image={log.coverUrl} />
				<div class="review-details">
					<h4><a href={log.url}>{log.record.game.title}</a></h4>
					<div class="review-reactions">
						{#if log.record.rating}
							<RatingStars value={log.record.rating} size={14} />
						{/if}
						{#if log.record.liked}
							<div class="liked" role="img" aria-label="Liked">
								<Icon name="heart-solid" />
							</div>
						{/if}
						{#if log.commentCount}
							<div class="count">
								<Icon name="chat-circle" label="Comments" />
								{log.commentCount}
							</div>
						{/if}
						{#if mediaCount}
							<div class="count">
								<Icon name="image" label="Media" />
								{mediaCount}
							</div>
						{/if}
					</div>
					<div class="review-content">
						{log.record.review?.text}
					</div>
				</div>
			</div>
		{/if}
	</div>
</ActivityBase>

<style>
.log-activity {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.log-review {
	display: grid;
	grid-template-columns: 74px 1fr;
	gap: 8px;
}

.review-details {
	display: flex;
	flex-direction: column;
	gap: 12px;

	h4 {
		font-size: 1.125rem;
		color: var(--color-grey-050);
		text-box: trim-both cap alphabetic;

		> a {
			text-decoration: none;

			&:hover {
				color: var(--color-grey-200);
			}
		}
	}
}

.review-reactions {
	display: flex;
	gap: 8px;
	align-items: center;
	font-size: 0.875rem;
}

.liked {
	display: flex;
	color: var(--color-pink-500);
}

.count {
	display: flex;
	gap: 4px;
	align-items: center;
	color: var(--color-grey-400);
}

.review-content {
	font-size: 0.875rem;
}
</style>
