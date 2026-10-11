<script lang="ts">
import { page } from '$app/state'
import type { RespawnLogRecord } from '$lib/atproto/log'
import { activityVerb } from '$lib/log-form'
import ActivityBase from './activity-base.svelte'
import RatingStars from './rating-stars.svelte'

interface LogActor {
	did: string
	name: string
	url: string
	avatar?: string | null
}

interface Props {
	actor: LogActor
	log: { url: string; record: RespawnLogRecord }
	createdAt?: string
}

let { actor, log, createdAt }: Props = $props()

let isViewer = $derived(actor.did === page.data.user?.did)
</script>

<ActivityBase showAvatar={!isViewer} avatar={actor.avatar} {createdAt}>
	<div class="log-activity">
		{#if isViewer}
			<span>You</span>
		{:else}
			<a class="profile-link" href={actor.url}>{actor.name}</a>
		{/if}
		<a class="activity-link" href={log.url}>
			<span class="activity-verb">{activityVerb(log.record)}</span>
			<span class="activity-game">{log.record.game.title}</span>
		</a>
		{#if log.record.rating}
			<RatingStars value={log.record.rating} isInline size={12} />
		{/if}
	</div>
</ActivityBase>

<style>
</style>
