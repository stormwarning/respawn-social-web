<script lang="ts">
import { page } from '$app/state'
import type { RespawnLogRecord } from '$lib/atproto/log'
import ActivityBase from './activity-base.svelte'

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
		{#if authorIsViewer}
			<a class="log-link" href={log.url}>your review</a>
		{:else}
			<a class="profile-link" href={log.author.url}>{log.author.name}’s</a>
			<a class="log-link" href={log.url}>review</a>
		{/if}
		of <a class="game-link" href="/game/{log.record.game.slug}/">{log.record.game.title}</a>
	</div>
</ActivityBase>

<style>
</style>
