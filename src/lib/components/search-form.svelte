<script lang="ts">
	import { goto } from '$app/navigation'

	let q = $state('')

	function toQuerySegment(value: string) {
		return encodeURIComponent(value.trim()).replace(/%20/g, '+')
	}

	function onsubmit(event: SubmitEvent) {
		event.preventDefault()
		const trimmed = q.trim()
		if (!trimmed) return
		goto(`/search/${toQuerySegment(trimmed)}/`)
	}
</script>

<form id="search" class="form" action="/search/" method="get" {onsubmit}>
	<fieldset>
		<label class="sr-only" for="search-q">Search:</label>
		<input
			id="search-q"
			class="input"
			type="text"
			name="q"
			inputmode="search"
			autocorrect="off"
			bind:value={q}
		/>
		<input class="submit" type="submit" value="Search" />
	</fieldset>
</form>

<style></style>
