<script lang="ts">
import { page } from '$app/state'
import ActivityBase from './activity-base.svelte'

interface FollowActor {
	did: string
	name: string
	url: string
	avatar?: string | null
}

interface Props {
	actor: FollowActor
	subject: FollowActor
	createdAt?: string
}

let { actor, subject, createdAt }: Props = $props()

let viewerDid = $derived(page.data.user?.did ?? null)
let actorIsViewer = $derived(actor.did === viewerDid)
let subjectIsViewer = $derived(subject.did === viewerDid)
</script>

<ActivityBase showAvatar={!actorIsViewer} avatar={actor.avatar} {createdAt}>
	<div class="follow-activity">
		{#if actorIsViewer}
			<span>You</span>
		{:else}
			<a class="profile-link" href={actor.url}>{actor.name}</a>
		{/if}
		followed
		{#if subjectIsViewer}
			<span>you</span>
		{:else}
			<a class="profile-link" href={subject.url}>{subject.name}</a>
		{/if}
	</div>
</ActivityBase>

<style>
</style>
