<script lang="ts">
import type { Snippet } from 'svelte'
import { textOf, type SpoilerRun } from '$lib/richtext/render'
import { scramble, seededRandom } from '$lib/richtext/scramble'

interface Props {
	group: SpoilerRun
	children: Snippet
}

let { group, children }: Props = $props()

let revealed = $state(false)
// Hidden spoilers render same-length filler, so the real text is never in the DOM.
// A fixed seed keeps server and client output identical.
let filler = $derived(scramble(textOf(group), seededRandom(1)))

function onkeydown(event: KeyboardEvent) {
	if (event.key === 'Enter' || event.key === ' ') {
		event.preventDefault()
		revealed = true
	}
}
</script>

<!-- The element stays in place when revealed, so keyboard focus isn't lost. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<span
	class="spoiler"
	role={revealed ? undefined : 'button'}
	tabindex={revealed ? -1 : 0}
	aria-label={revealed ? undefined : 'Spoiler, activate to reveal'}
	onclick={() => (revealed = true)}
	onkeydown={revealed ? undefined : onkeydown}
	>{#if revealed}{@render children()}{:else}<span aria-hidden="true">{filler}</span>{/if}</span
>
