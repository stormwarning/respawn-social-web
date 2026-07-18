<script>
let { data, onsearch } = $props()
</script>

<header class="header">
	<a class="header-logo" href="/" aria-label="Home">
		<div class="header-logo-block">
			<span class="logo"></span>
		</div>
	</a>
	<div class="header-actions">
		<button class="button is-icon-only" type="button" onclick={onsearch} aria-label="Search">
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M21.78 20.72L17.44 16.38C18.7718 14.8066 19.5019 12.8114 19.5 10.75C19.5 5.925 15.575 2 10.75 2C5.925 2 2 5.925 2 10.75C2 15.575 5.925 19.5 10.75 19.5C12.8114 19.5019 14.8066 18.7718 16.38 17.44L20.72 21.78L21.78 20.72ZM3.5 10.75C3.5 6.75 6.75 3.5 10.75 3.5C14.75 3.5 18 6.75 18 10.75C18 14.75 14.75 18 10.75 18C6.75 18 3.5 14.75 3.5 10.75Z"
					fill="currentcolor"
				/>
			</svg>
		</button>
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

	&::before {
		position: absolute;
		inset: 0;
		background-color: var(--color-grey-800);
		opacity: 0;
		content: '';
		scale: 1 0;
		transform-origin: top;
		transition:
			scale 100ms ease-out,
			opacity 100ms ease-out;
	}

	> * {
		position: relative;
	}
}

:global(body:has(dialog[open])) .header {
	&::before {
		opacity: 1;
		scale: 1 1;
	}
}

.header-logo {
	border-radius: 0;
}

.header-logo-block {
	--logo-padding: 19px;

	display: flex;
	padding: var(--logo-padding);
	padding-top: calc(env(safe-area-inset-top) + var(--logo-padding));
	background-color: var(--color-blue-100);
	border-radius: 0;
	mask-image: linear-gradient(#fff 0 0), url('./logo.svg');
	mask-repeat: no-repeat;
	mask-position:
		0 0,
		var(--logo-padding) calc(env(safe-area-inset-top) + var(--logo-padding));
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
}
</style>
