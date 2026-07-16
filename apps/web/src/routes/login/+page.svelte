<script lang="ts">
import TextInput from '$lib/components/text-input.svelte'
import type { ActionData } from './$types'

let { form }: { form: ActionData } = $props()
</script>

<svelte:head>
	<title>Sign in 🞍 Respawn</title>
</svelte:head>

<div class="wrapper">
	<h1 class="heading">Sign in with your ATmosphere account.</h1>

	<form class="login" method="POST">
		<TextInput
			label="Account name"
			message={form?.error}
			reserveMessageSpace={false}
			id="handle"
			name="handle"
			placeholder="alice.bsky.social"
			autocomplete="username"
			required
			inputmode="url"
		/>

		<p class="body sm secondary">
			By signing in you agree to the <a href="/terms-of-use/">Terms of use</a> and
			<a href="/privacy-policy/">Privacy policy</a>.
		</p>

		<button class="button primary" type="submit">Start</button>
	</form>
</div>

<style>
.wrapper {
	display: grid;
	gap: 32px;
	max-width: 22rem;
	padding: 64px 0;
}

.login {
	display: grid;
	gap: 32px;
}
</style>
