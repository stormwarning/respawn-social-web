<script lang="ts">
import { page } from '$app/state'
import AvatarImage from './avatar-image.svelte'

interface Props {
	handle: string
	displayName?: string | null
	avatarUrl?: string | null
	/**
	 * The signed-in viewer's own activity lives at the handle-less routes, and
	 * `/[handle]/activity` redirects there anyway — link straight at it.
	 */
	isSelf?: boolean
}

let { handle, displayName, avatarUrl = null, isSelf = false }: Props = $props()

let name = $derived(displayName || handle)
let activityHref = $derived(isSelf ? '/activity/' : `/${handle}/activity/`)

/**
 * A section owns its sub-pages — the paginated game and backlog lists, and the
 * activity feeds that hang off `/activity` — so the parent link is what gets
 * marked, by prefix rather than an exact match. Every route here has
 * `trailingSlash: 'always'`, so the hrefs already end in the separator that
 * keeps `/games/` from matching a sibling like `/games-list/`.
 */
let current = (href: string) => (page.url.pathname.startsWith(href) ? 'page' : undefined)
</script>

<nav class="nav">
	<div class="profile">
		<!-- The profile link owns only its own page: every section below is nested under it. -->
		<a href="/{handle}/" aria-current={page.url.pathname === `/${handle}/` ? 'page' : undefined}>
			<AvatarImage image={avatarUrl} />
			<span>{name}</span>
		</a>
	</div>
	<ul class="links">
		<li><a href={activityHref} aria-current={current(activityHref)}>Activity</a></li>
		<li><a href="/{handle}/games/" aria-current={current(`/${handle}/games/`)}>Games</a></li>
		<!-- <li><a href="/">Reviews</a></li> -->
		<li><a href="/{handle}/backlog/" aria-current={current(`/${handle}/backlog/`)}>Backlog</a></li>
		<!-- <li><a href="/">Lists</a></li> -->
	</ul>
	<div class="spacer"></div>
</nav>

<style>
.nav {
	display: flex;
	padding: 12px 16px;
	background-color: var(--color-grey-700);
	border-radius: 8px;

	@supports (corner-shape: squircle) {
		border-radius: 16px;
		corner-shape: var(--corner-shape);
	}
}

.profile {
	flex: 1 1 100%;

	a {
		display: grid;
		grid-template-columns: 1.25rem 1fr;
		align-items: center;
		gap: 8px;
		text-decoration: none;
	}

	span {
		font-size: 0.875rem;
		font-weight: 600;
		text-box: trim-both cap alphabetic;
		letter-spacing: 0.01em;
	}
}

.links {
	display: flex;
	flex: 1 1 100%;
	align-items: center;
	justify-content: center;
	gap: 16px;
	padding: 0;
	list-style: none;

	@container (max-width: 599px) {
		display: none;
	}

	a {
		display: block;
		padding: 4px 0;
		font-size: 0.875rem;
		color: var(--color-grey-300);
		text-box: trim-both cap alphabetic;
		text-decoration: none;
		letter-spacing: 0.01em;

		&[aria-current='page'] {
			color: #fff;
		}
	}
}

.spacer {
	flex: 1 1 100%;
}
</style>
