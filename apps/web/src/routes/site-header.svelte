<script>
import { Icon } from '@respawn-social/icons'
import AvatarImage from '$lib/components/avatar-image.svelte'

let { data, onsearch } = $props()
</script>

<header class="header">
	<a class="header-logo" href="/" aria-label="Home">
		<div class="header-logo-block">
			<span class="logo"></span>
		</div>
	</a>
	<div class="header-actions">
		<a href="/games/">Games</a>
		<button class="button is-icon-only" type="button" onclick={onsearch} aria-label="Search">
			<Icon name="magnifying-glass" width="20" height="20" />
		</button>
		{#if data.user}
			<a class="who" href="/{data.user.handle}/">
				<AvatarImage image={data.user.avatarUrl} loading="eager" />
				<!-- <span>{data.user.handle ?? data.user.did}</span> -->
			</a>
			<form method="POST" action="/logout/">
				<button class="button" type="submit"><div>Sign out</div></button>
			</form>
		{:else}
			<a class="button primary" href="/login/"><div>Start</div></a>
		{/if}
	</div>
</header>

<style>
.header {
	position: sticky;
	inset-block-start: 0;
	z-index: 10;
	display: flex;
	justify-content: space-between;
	inline-size: 100%;
	max-inline-size: 60rem;
	padding-inline: calc(env(safe-area-inset-left) + 16px) calc(env(safe-area-inset-right) + 16px);
	margin: 0 auto;

	&::before {
		position: absolute;
		inset: 0;
		content: '';
		background-color: var(--color-grey-800);
		opacity: 0;
		transform-origin: top;
		scale: 1 0;
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
	padding-block-start: calc(env(safe-area-inset-top) + var(--logo-padding));
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
	inline-size: 42px;
	block-size: 42px;
}

.header-actions {
	display: flex;
	gap: 8px;
	align-items: center;
	padding-block-start: calc(env(safe-area-inset-top) + 0px);
}

.who {
	display: flex;
	gap: 4px;
	align-items: center;
	min-inline-size: 36px;

	:global(> div) {
		max-inline-size: 36px;
	}
}
</style>
