<script lang="ts">
import type { Snippet } from 'svelte'
import type { HTMLInputAttributes } from 'svelte/elements'
import AvatarImage from './avatar-image.svelte'
import InputField, { type Tone } from './input-field.svelte'

interface Props extends Omit<HTMLInputAttributes, 'id' | 'disabled' | 'type' | 'accept'> {
	id?: string
	accept?: string
	/** The avatar currently saved on the profile. */
	value?: string | null
	/** When set, offers a button that reuses this Bluesky avatar. */
	bskyAvatar?: string | null
	/**
	 * Name of the hidden input carrying the choice the file input can't express:
	 * `bluesky` to copy the Bluesky avatar, `remove` to clear it.
	 */
	actionName?: string
	label?: string | Snippet
	tertiaryLabel?: string | Snippet
	description?: string | Snippet
	message?: string | Snippet
	tone?: Tone
	reserveMessageSpace?: boolean
	disabled?: boolean
}

let {
	id,
	value = null,
	bskyAvatar = null,
	name = 'avatar',
	accept = 'image/png,image/jpeg,image/webp',
	actionName = 'avatarAction',
	label,
	tertiaryLabel,
	description,
	message = 'PNG, JPEG, or WebP · max 1 MB',
	tone,
	reserveMessageSpace,
	disabled,
	...rest
}: Props = $props()

let input: HTMLInputElement | undefined = $state()
let dragging = $state(false)
/** Object URL for a file picked this session, revoked when it is replaced. */
let previewUrl = $state<string | null>(null)
let action = $state<'' | 'bluesky' | 'remove'>('')

let shown = $derived(
	action === 'remove' ? null : action === 'bluesky' ? bskyAvatar : (previewUrl ?? value),
)

let acceptedTypes = $derived(
	accept
		.split(',')
		.map((type) => type.trim())
		.filter(Boolean),
)

function accepts(file: File) {
	return acceptedTypes.some((type) =>
		type.endsWith('/*') ? file.type.startsWith(type.slice(0, -1)) : file.type === type,
	)
}

function showPreview(file: File | undefined) {
	if (previewUrl) URL.revokeObjectURL(previewUrl)
	previewUrl = file ? URL.createObjectURL(file) : null
	action = ''
}

function onChange() {
	showPreview(input?.files?.[0])
}

function onDrop(event: DragEvent) {
	event.preventDefault()
	dragging = false
	if (disabled || !input) return

	const file = event.dataTransfer?.files?.[0]
	if (!file || !accepts(file)) return

	// Hand the drop off to the file input so the form submits it like a pick.
	const transfer = new DataTransfer()
	transfer.items.add(file)
	input.files = transfer.files
	showPreview(file)
}

function chooseBsky() {
	if (input) input.value = ''
	showPreview(undefined)
	action = 'bluesky'
}

function remove() {
	if (input) input.value = ''
	showPreview(undefined)
	action = 'remove'
}

$effect(() => () => {
	if (previewUrl) URL.revokeObjectURL(previewUrl)
})
</script>

<InputField
	{id}
	{label}
	{tertiaryLabel}
	{description}
	{message}
	{tone}
	{reserveMessageSpace}
	{disabled}
>
	{#snippet children(field)}
		<!-- The buttons inside carry the keyboard affordances; the zone itself is pointer-only. -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class={['dropzone', { dragging, disabled }]}
			ondragover={(event) => {
				event.preventDefault()
				if (!disabled) dragging = true
			}}
			ondragleave={() => (dragging = false)}
			ondrop={onDrop}
		>
			<div class="avatar">
				<AvatarImage image={shown} />
			</div>

			<div class="actions">
				<button class="button small" type="button" {disabled} onclick={() => input?.click()}>
					<span>Select new avatar</span>
				</button>
				{#if bskyAvatar}
					<button
						class="button small"
						type="button"
						disabled={disabled || action === 'bluesky'}
						onclick={chooseBsky}
					>
						<span>Load from Bluesky</span>
					</button>
				{/if}
				{#if shown}
					<button class="button small" type="button" {disabled} onclick={remove}>
						<span>Remove</span>
					</button>
				{/if}
			</div>

			<input
				bind:this={input}
				class="file-input"
				type="file"
				{name}
				{accept}
				onchange={onChange}
				tabindex="-1"
				{...rest}
				{...field}
			/>
			{#if action}
				<input type="hidden" name={actionName} value={action} />
			{/if}
		</div>
	{/snippet}
</InputField>

<style>
.dropzone {
	display: flex;
	align-items: center;
	gap: 16px;
	padding: 12px;
	border: 1px dashed var(--color-grey-400);
	border-radius: 4px;

	@supports (corner-shape: squircle) {
		border-radius: 8px;
		corner-shape: var(--corner-shape);
	}
}

.dropzone.dragging {
	border-color: var(--color-accent);
	border-style: solid;
	background: var(--color-grey-600);
}

.dropzone.disabled {
	opacity: 0.6;
}

.avatar {
	flex: none;
	width: 64px;
}

.actions {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}

.file-input {
	position: absolute;
	width: 1px;
	height: 1px;
	overflow: hidden;
	clip-path: inset(50%);
	white-space: nowrap;
}
</style>
