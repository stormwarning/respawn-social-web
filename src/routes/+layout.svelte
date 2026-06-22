<script lang="ts">
	import '../app.css';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
</script>

<header>
	<a href="/" class="brand">Respawn Social</a>
	<nav>
		{#if data.user}
			<a class="who" href="/profile">
				{#if data.user.avatarUrl}
					<img class="avatar" src={data.user.avatarUrl} alt="" />
				{/if}
				<span>{data.user.handle ?? data.user.did}</span>
			</a>
			<form method="POST" action="/logout">
				<button type="submit">Log out</button>
			</form>
		{:else}
			<a href="/login">Log in</a>
		{/if}
	</nav>
</header>

<main>
	{@render children()}
</main>

<style>
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface);
	}

	.brand {
		font-size: var(--text-lg);
		font-weight: 700;
		color: var(--color-text);
	}

	nav {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.who {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--color-muted);
		font-size: var(--text-sm);
		text-decoration: none;
	}

	.avatar {
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		object-fit: cover;
	}

	main {
		max-width: 48rem;
		margin: 0 auto;
		padding: var(--space-4);
	}

	button {
		background: transparent;
		color: var(--color-accent);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		padding: var(--space-1) var(--space-3);
		cursor: pointer;
	}
</style>
