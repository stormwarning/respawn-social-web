<script lang="ts">
import { credits, grainPhotoUrl, type GrainPhoto } from '$lib/atproto/grain'
import GrainMedia from './grain-media.svelte'

interface Props {
	/** Photos as they are now; deleted ones already left out. */
	photos: GrainPhoto[]
}

let { photos }: Props = $props()

let photoCredits = $derived(credits(photos))
</script>

{#if photos.length}
	<figure class="grain-card">
		<GrainMedia {photos} href={grainPhotoUrl} />
		<figcaption class="credit">
			{#if photoCredits.length === 1 && photoCredits[0].gallery}
				{@const [credit] = photoCredits}
				<a href={credit.href} target="_blank" rel="noopener noreferrer"
					><strong>{credit.gallery?.title}</strong></a
				>
				<span class="muted">by @{credit.handle} on Grain</span>
			{:else}
				<span class="muted">Photos by</span>
				{#each photoCredits as credit, i (credit.handle)}
					{#if i > 0}<span class="muted">{i === photoCredits.length - 1 ? 'and' : ','}</span>{/if}
					<a href={credit.href} target="_blank" rel="noopener noreferrer">@{credit.handle}</a>
				{/each}
				<span class="muted">on Grain</span>
			{/if}
		</figcaption>
	</figure>
{/if}

<style>
.grain-card {
	display: grid;
	gap: 8px;
	margin: 0;
}

.credit {
	display: flex;
	flex-wrap: wrap;
	gap: 0 0.3em;
	align-items: baseline;
	font-size: var(--text-sm);

	a {
		color: inherit;
	}
}

.muted {
	color: var(--color-grey-400);
}
</style>
