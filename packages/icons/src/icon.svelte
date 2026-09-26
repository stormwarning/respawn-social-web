<script lang="ts">
import type { SVGAttributes } from 'svelte/elements'
import type { IconName } from './icon-names.ts'
// Never inline: fragment refs (`#name`) need a real URL, not a data: URI.
import spriteUrl from './sprite.svg?no-inline'

interface Props extends SVGAttributes<SVGSVGElement> {
	/** Icon filename minus the `icon-` prefix, e.g. `text-bold`. */
	name: IconName
	/** Accessible name. Without one the icon is decorative and hidden from AT. */
	label?: string
}

let { name, label, ...rest }: Props = $props()
</script>

<svg
	width="1em"
	height="1em"
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
	{...rest}
>
	<use href="{spriteUrl}#{name}" />
</svg>
