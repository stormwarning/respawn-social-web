<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Live preview for a newly picked avatar before submit.
	let avatarPreview = $state<string | null>(null);

	function onAvatarChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		avatarPreview = file ? URL.createObjectURL(file) : null;
	}

	const shownAvatar = $derived(avatarPreview ?? data.avatarUrl);
</script>

<svelte:head>
	<title>Edit profile · Respawn Social</title>
</svelte:head>

<h1>Your Respawn profile</h1>
<p class="hint">
	Prefilled from your Bluesky profile. Changes here are saved as a Respawn record on your PDS.
</p>

<form method="POST" enctype="multipart/form-data" class="profile" use:enhance>
	<div class="avatar-row">
		{#if shownAvatar}
			<img class="avatar" src={shownAvatar} alt="Avatar preview" />
		{:else}
			<div class="avatar placeholder" aria-hidden="true"></div>
		{/if}
		<div class="avatar-field">
			<label for="avatar">Avatar</label>
			<input
				id="avatar"
				name="avatar"
				type="file"
				accept="image/png,image/jpeg,image/webp"
				onchange={onAvatarChange}
			/>
			<span class="sub">PNG, JPEG, or WebP · max 1 MB</span>
		</div>
	</div>

	<label for="handle">Handle</label>
	<input id="handle" value={data.handle} type="text" readonly />

	<label for="displayName">Display name</label>
	<input
		id="displayName"
		name="displayName"
		type="text"
		value={data.displayName}
		maxlength="640"
		placeholder="Your name"
	/>

	<label for="description">Description</label>
	<textarea id="description" name="description" rows="4" maxlength="2560"
		>{data.description}</textarea
	>

	{#if form?.error}
		<p class="error">{form.error}</p>
	{/if}
	{#if form?.success}
		<p class="success">Profile saved.</p>
	{/if}

	<button type="submit">Save profile</button>
</form>

<style>
	.hint {
		color: var(--color-muted);
		font-size: var(--text-sm);
	}

	.profile {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		max-width: 30rem;
	}

	.avatar-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin-bottom: var(--space-2);
	}

	.avatar {
		width: 4rem;
		height: 4rem;
		border-radius: 50%;
		object-fit: cover;
		border: 1px solid var(--color-border);
	}

	.avatar.placeholder {
		background: var(--color-surface);
	}

	.avatar-field {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	label {
		font-size: var(--text-sm);
		color: var(--color-muted);
	}

	.sub {
		font-size: var(--text-sm);
		color: var(--color-muted);
	}

	input,
	textarea {
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
		font: inherit;
	}

	input[readonly] {
		color: var(--color-muted);
	}

	button {
		margin-top: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border: none;
		border-radius: var(--radius);
		background: var(--color-accent);
		color: #07101f;
		font-weight: 600;
		cursor: pointer;
		align-self: flex-start;
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
