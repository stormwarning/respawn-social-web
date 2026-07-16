<script lang="ts" module>
export type Tone = 'neutral' | 'critical' | 'positive' | 'caution'

/** Attributes the field passes to its form element via the `children` snippet. */
export interface FieldAttrs {
	id: string
	'aria-describedby'?: string
	'aria-invalid'?: boolean
	disabled?: boolean
}
</script>

<script lang="ts">
import type { Snippet } from 'svelte'

import FieldLabel from './field-label.svelte'
import FieldMessage from './field-message.svelte'

interface Props {
	children: Snippet<[FieldAttrs]>
	'aria-describedby'?: string
	description?: string | Snippet
	disabled?: boolean
	id?: string
	label?: string | Snippet
	message?: string | Snippet
	reserveMessageSpace?: boolean
	tertiaryLabel?: string | Snippet
	tone?: Tone
}

const defaultId = $props.id()

let {
	children,
	'aria-describedby': describedBy,
	description,
	disabled = false,
	id = defaultId,
	label,
	message,
	reserveMessageSpace = true,
	tertiaryLabel,
	tone = 'neutral',
}: Props = $props()

let messageId = $derived(`${id}--message`)
let descriptionId = $derived(`${id}--description`)
let showMessage = $derived(!disabled && Boolean(message))

let fieldAttrs: FieldAttrs = $derived({
	id,
	disabled: disabled || undefined,
	'aria-describedby':
		[describedBy, showMessage ? messageId : undefined, description ? descriptionId : undefined]
			.filter(Boolean)
			.join(' ') || undefined,
	'aria-invalid': tone === 'critical' || undefined,
})
</script>

<div class="input-field">
	<FieldLabel
		for={id}
		{label}
		{tertiaryLabel}
		{description}
		descriptionId={description ? descriptionId : undefined}
		{disabled}
	/>
	<div class="input-wrapper">
		{@render children(fieldAttrs)}
		<FieldMessage id={messageId} {message} {tone} {reserveMessageSpace} {disabled} />
	</div>
</div>

<style>
.input-field {
	display: grid;
	gap: 8px;
}

.input-wrapper {
	display: grid;
	gap: 8px;
}
</style>
