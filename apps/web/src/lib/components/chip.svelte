<script lang="ts">
let { children }: { children: import('svelte').Snippet } = $props()
</script>

<div class="chip">
	{@render children()}
</div>

<style>
.chip {
	padding: 6px;
	font-size: 0.875rem;
	color: var(--color-grey-100);
	letter-spacing: 0.02em;
	text-box: trim-both cap alphabetic;
	background-color: var(--color-grey-700);
	border-radius: 4px;
	corner-shape: var(--corner-shape);
	box-shadow: inset 0 1px 0 0 rgb(255 255 255 / 20%);
}
</style>
