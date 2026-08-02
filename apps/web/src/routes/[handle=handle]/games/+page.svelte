<script lang="ts">
import GamesView from './games-view.svelte'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()
</script>

<GamesView {data} />
