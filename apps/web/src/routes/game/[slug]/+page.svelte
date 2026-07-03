<script lang="ts">
import { enhance } from '$app/forms'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()
// svelte-ignore state_referenced_locally -- intentional seed; resynced by the $effect below
let played = $state(data.played)
let saving = $state(false)

// Resync when navigating between games (the component instance is reused).
$effect(() => {
	played = data.played
})
</script>

<svelte:head>
	<title>{data.game.name} · Respawn Social</title>
</svelte:head>

<article>
	<h1>{data.game.name}</h1>
	<img src={data.game.cover?.url} alt="" />
	{#if data.isLoggedIn}
		<form
			method="POST"
			action="?/toggle"
			use:enhance={() => {
				saving = true
				return ({ result, update }) => {
					if (result.type === 'success' && result.data) {
						played = Boolean(result.data.played)
					}
					saving = false
					update({ reset: false })
				}
			}}
		>
			<input type="hidden" name="igdbId" value={data.game.id} />
			<input type="hidden" name="coverUrl" value={data.game.cover?.url ?? ''} />
			<button type="submit" disabled={saving}>
				{played ? 'Played ✓ (click to remove)' : 'Mark as played'}
			</button>
		</form>
	{/if}
	{#if data.game.summary}
		<p>{data.game.summary}</p>
	{/if}
	<p>Website: {data.site}</p>
	<p>IGDB: {data.game.url}</p>
	<p>Where to play:</p>
	<ul>
		{#each data.game.external_games as item}<li>{item.url}</li>{/each}
	</ul>
	<p>Developer: {data.game.developer}</p>
	<p>Publisher: {data.game.publisher}</p>
	<p>Platforms:</p>
	<ul>
		{#each data.game.platforms as platform}<li>{platform.name}</li>{/each}
	</ul>
	<p>Genres:</p>
	<ul>
		{#each data.game.genres as genre}<li>{genre.name}</li>{/each}
	</ul>
</article>
