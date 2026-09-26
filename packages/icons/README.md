# @respawn-social/icons

SVG icons compiled into one `<symbol>` sprite, rendered with a single `<Icon>` component.

## Adding an icon

1. Drop `icon-<name>.svg` into `icons/`. Draw in black (`#000`/`black`); it becomes `currentColor`. Only black, `currentColor` and `none` are allowed for `fill`/`stroke`.
2. Run `pnpm --filter @respawn-social/icons build`.
3. Commit the regenerated `src/sprite.svg` and `src/icon-names.ts`.

## Usage

```svelte
<script lang="ts">
import { Icon } from '@respawn-social/icons'
</script>

<Icon name="text-bold" />
<Icon name="text-bold" label="Bold" class="toolbar-icon" />
```

Icons default to `1em` square and inherit `color`. Without `label` the icon is `aria-hidden`.
