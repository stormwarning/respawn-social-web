<script lang="ts">
import BacklogView from './backlog-view.svelte'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()
</script>

<BacklogView {data} />
