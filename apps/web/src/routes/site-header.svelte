<script>
let data = $props()
</script>

<header class="header">
	<a class="header-logo" href="/" aria-label="Home">
		<div class="header-logo-block">
			<span class="logo"></span>
		</div>
	</a>
	<div class="header-actions">
		<button class="button" type="button"><div>Search</div></button>
		{#if data.user}
			<a class="who" href="/settings/">
				{#if data.user.avatarUrl}
					<img class="avatar" src={data.user.avatarUrl} alt="" />
				{/if}
				<span>{data.user.handle ?? data.user.did}</span>
			</a>
			<form method="POST" action="/logout/">
				<button type="submit">Log out</button>
			</form>
		{:else}
			<a class="button primary" href="/login/"><div>Start</div></a>
		{/if}
	</div>
</header>

<style>
.header {
	position: sticky;
	top: 0;
	display: flex;
	justify-content: space-between;
	padding-inline: 16px;
}

.header-logo {
	border-radius: 0;
}

.header-logo-block {
	display: flex;
	padding: 1rem;
	padding-top: calc(env(safe-area-inset-top) + 1rem);
	background-color: var(--color-blue-100);
	border-radius: 0;
	mask-image: linear-gradient(#fff 0 0), url('./logo.svg');
	mask-repeat: no-repeat;
	mask-position:
		0 0,
		1rem calc(env(safe-area-inset-top) + 1rem);
	mask-size:
		auto,
		42px 42px;
	mask-composite: exclude;
}

.logo {
	display: flex;
	width: 42px;
	height: 42px;
}

.header-actions {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 1rem;
}
</style>
