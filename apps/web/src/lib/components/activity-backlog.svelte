<script lang="ts">
import { page } from '$app/state'
import { possessivePronoun } from '$lib/atproto/pronouns'
import ActivityBase from './activity-base.svelte'

interface BacklogActor {
	did: string
	name: string
	url: string
	backlogUrl: string
	avatar?: string | null
	pronouns?: string | null
}

interface Props {
	actor: BacklogActor
	game: { slug: string; title: string }
	createdAt?: string
}

let { actor, game, createdAt }: Props = $props()

let isViewer = $derived(actor.did === page.data.user?.did)
// "their" when the profile record didn't load, per the lexicon's stated default.
let possessive = $derived(isViewer ? 'your' : possessivePronoun(actor.pronouns))
</script>

<ActivityBase showAvatar={!isViewer} avatar={actor.avatar} {createdAt}>
	<div class="backlog-activity">
		{#if isViewer}
			<span>You</span>
		{:else}
			<a class="profile-link" href={actor.url}>{actor.name}</a>
		{/if}
		added <a class="game-link" href="/game/{game.slug}/">{game.title}</a>
		to <a class="backlog-link" href={actor.backlogUrl}>{possessive} backlog</a>
	</div>
</ActivityBase>

<style>
</style>
