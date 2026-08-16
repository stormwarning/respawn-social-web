<script lang="ts">
import { enhance } from '$app/forms'
import SelectField from '$lib/components/select-field.svelte'
import TextInput from '$lib/components/text-input.svelte'
import Textarea from '$lib/components/textarea.svelte'
import { PRONOUN_VALUES } from '$lib/atproto/pronouns'
import type { ActionData, PageData } from './$types'
import AvatarField from '$lib/components/avatar-field.svelte'
import FavesField from '$lib/components/faves-field.svelte'

let { data, form }: { data: PageData; form: ActionData } = $props()
</script>

<svelte:head>
	<title>Account settings · Respawn</title>
</svelte:head>

<article class="page">
	<h1>Account settings</h1>

	<form class="profile-settings" method="POST" enctype="multipart/form-data" use:enhance>
		<fieldset class="main">
			<AvatarField label="Avatar" id="avatar" name="avatar" value={data.avatarUrl} />

			<!-- <label for="handle">Handle</label>
		<input id="handle" value={data.handle} type="text" readonly /> -->

			<TextInput
				label="Display name"
				reserveMessageSpace={false}
				id="displayName"
				name="displayName"
				value={data.displayName}
				maxlength={640}
				autocapitalize="off"
				autocorrect="off"
			/>

			<Textarea
				label="Bio"
				reserveMessageSpace={false}
				id="description"
				name="description"
				value={data.description}
				maxlength={2560}
			/>

			<SelectField
				label="Pronouns"
				reserveMessageSpace={false}
				id="pronouns"
				name="pronouns"
				value={data.pronouns}
			>
				{#each PRONOUN_VALUES as value (value)}
					<option {value}>{value}</option>
				{/each}
			</SelectField>

			<!-- <TextInput
			label="Channel"
			id="channel"
			name="channel"
			value={data.channel}
			type="url"
			placeholder="https://stream.place/…"
		/> -->

			<!-- <label for="bsky">Bluesky account (DID)</label>
		<input id="bsky" name="bsky" type="text" value={data.bsky} placeholder="did:plc:…" />
		<span class="sub">Lets viewers open your Bluesky profile in their preferred client.</span> -->

			<SelectField
				label="Adult content"
				reserveMessageSpace={false}
				id="adultContent"
				name="adultContent"
				value={data.adultContent}
			>
				<option value="show">Show</option>
				<option value="blur">Blur</option>
				<option value="hide">Hide</option>
			</SelectField>
		</fieldset>

		<fieldset class="sidebar">
			<FavesField
				label="Favourite games"
				reserveMessageSpace={false}
				name="faves"
				value={data.faves}
			/>
		</fieldset>

		{#if form?.error}
			<p class="error">{form.error}</p>
		{/if}
		{#if form?.success}
			<p class="success">Profile saved.</p>
		{/if}

		<div>
			<button class="button primary" type="submit"><div>Save profile</div></button>
		</div>
	</form>
</article>

<style>
.page {
	display: grid;
	gap: 32px;
	padding: 32px 0;
}

h1 {
	font-size: 1.5rem;
	font-weight: 600;
	line-height: 1.2;
	text-box: trim-both cap alphabetic;
}

.profile-settings {
	display: grid;
	gap: 32px;

	@container (min-width: 600px) {
		/*max-width: 50%;*/
		grid-template-columns: 1fr 1fr;
	}
}

.main {
	display: grid;
	gap: 32px;
	padding: 0;
	border: 0;
}

.sidebar {
	padding: 0;
	border: 0;
}

.error {
	color: #ff8a8a;
	font-size: var(--text-sm);
}

.success {
	color: var(--color-accent);
	font-size: var(--text-sm);
}
</style>
