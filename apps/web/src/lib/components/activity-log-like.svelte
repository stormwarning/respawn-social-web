<script lang="ts">
import { page } from '$app/state'
import type { RespawnLogRecord } from '$lib/atproto/log'
import ActivityBase from './activity-base.svelte'
import RatingStars from './rating-stars.svelte'

interface LikeActor {
	did: string
	name: string
	url: string
	avatar?: string | null
}

interface Props {
	actor: LikeActor
	/** The liked log and its author. Only a log with a review can be liked. */
	log: { url: string; author: LikeActor; record: RespawnLogRecord }
	createdAt?: string
}

let { actor, log, createdAt }: Props = $props()

let viewerDid = $derived(page.data.user?.did ?? null)
let actorIsViewer = $derived(actor.did === viewerDid)
let authorIsViewer = $derived(log.author.did === viewerDid)
</script>

<ActivityBase showAvatar={!actorIsViewer} avatar={actor.avatar} {createdAt}>
	<div class="log-like-activity">
		{#if actorIsViewer}
			<span>You</span>
		{:else}
			<a class="profile-link" href={actor.url}>{actor.name}</a>
		{/if}
		liked
		<span class="profile">
			{#if authorIsViewer}your{:else}{log.author.name}’s{/if}
		</span>
		<a class="activity-link" href={log.url}>
			{#if log.record.rating}<RatingStars value={log.record.rating} isInline size={12} />{/if}
			review of <span class="activity-game">{log.record.game.title}</span>
		</a>
	</div>
</ActivityBase>

<style>
</style>
