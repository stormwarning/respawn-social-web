<script lang="ts">
import { Icon, type IconName } from '@respawn-social/icons'
import { Editor, isMacOS } from '@tiptap/core'
import { tick, untrack } from 'svelte'
import { countGraphemes, isSafeLink, parse, serialize } from '$lib/richtext/facets'
import { createExtensions } from '$lib/richtext/editor'
import type { FacetFeature, RichDoc, RichTextValue } from '$lib/richtext/types'
import FieldLabel from './field-label.svelte'
import FieldMessage from './field-message.svelte'
import RichText from './rich-text.svelte'

interface Props {
	/** Record-ready rich text. Updates as the user types; assign to replace the content. */
	value?: RichTextValue
	label?: string
	description?: string
	placeholder?: string
	/** Grapheme limit from the lexicon, e.g. 10000 for reviews, 3000 for list descriptions. */
	maxGraphemes?: number
	/** Allow `||spoiler||` formatting. Only for fields whose lexicon has `textWithSpoilers`. */
	spoilers?: boolean
	/** Form field name; posts the value as JSON in a hidden input. */
	name?: string
	disabled?: boolean
}

let {
	value = $bindable({ text: '' }),
	label,
	description,
	placeholder,
	maxGraphemes,
	spoilers = true,
	name,
	disabled = false,
}: Props = $props()

const id = $props.id()
const labelId = `${id}--label`
const descriptionId = `${id}--description`
const messageId = `${id}--message`
const countId = `${id}--count`
const linkInputId = `${id}--link`

let editor = $state.raw<Editor>()
/** Bumped on every editor transaction so toolbar state re-derives. */
let revision = $state(0)
let mod = $state('Ctrl+')
/** JSON of the value this editor last emitted or loaded, to tell our own updates from outside ones. */
let synced = ''

let linkDraft = $state<string>()
let linkError = $state('')
let linkInput = $state<HTMLInputElement>()

let graphemes = $derived(
	Math.max(countGraphemes(value.text), countGraphemes(value.textWithSpoilers ?? '')),
)
let overLimit = $derived(maxGraphemes !== undefined && graphemes > maxGraphemes)

const isSpoiler = (feature: FacetFeature) =>
	feature.$type === 'social.respawn.richtext.facet#spoiler'

function emit(target: Editor) {
	const next = serialize(target.getJSON() as RichDoc)
	synced = JSON.stringify(next)
	value = next
}

/** Show `next` in the editor. Re-emits when spoilers had to be dropped, so the value matches what's shown. */
function load(target: Editor, next: RichTextValue) {
	// With spoilers off the schema has no spoiler mark, and Tiptap discards content with unknown marks.
	const strip = !spoilers && !!next.facets?.some((facet) => facet.features.some(isSpoiler))
	const facets = strip
		? next.facets?.map((facet) => ({
				...facet,
				features: facet.features.filter((f) => !isSpoiler(f)),
			}))
		: next.facets
	const doc = parse({ ...next, facets })
	target.commands.setContent(doc.content.length ? doc : '', { emitUpdate: false })
	if (strip) emit(target)
	else synced = JSON.stringify(next)
}

function mount(element: HTMLElement) {
	const instance = untrack(
		() =>
			new Editor({
				element,
				extensions: createExtensions({ placeholder, spoilers, onLinkShortcut: openLink }),
				editable: !disabled,
				editorProps: {
					attributes: {
						class: 'rich-text content',
						role: 'textbox',
						'aria-multiline': 'true',
						'aria-labelledby': labelId,
						'aria-describedby': [
							description ? descriptionId : undefined,
							maxGraphemes !== undefined ? countId : undefined,
							messageId,
						]
							.filter(Boolean)
							.join(' '),
					},
				},
				onTransaction: () => revision++,
				onUpdate: ({ editor: current }) => emit(current),
			}),
	)
	untrack(() => load(instance, value))
	mod = isMacOS() ? '⌘' : 'Ctrl+'
	editor = instance
	return () => {
		instance.destroy()
		editor = undefined
	}
}

// Load values assigned from outside, e.g. a record fetched for editing.
$effect(() => {
	const json = JSON.stringify(value)
	if (editor && json !== synced) untrack(() => load(editor!, value))
})

$effect(() => {
	editor?.setEditable(!disabled, false)
})

interface Tool {
	name: string
	icon: IconName
	label: string
	keys: string
	markdown: string
	run: (target: Editor) => void
}

let tools: Tool[] = $derived([
	{
		name: 'bold',
		icon: 'text-bold',
		label: 'Bold',
		keys: `${mod}B`,
		markdown: '**text**',
		run: (target) => target.chain().focus().toggleBold().run(),
	},
	{
		name: 'italic',
		icon: 'text-italic',
		label: 'Italic',
		keys: `${mod}I`,
		markdown: '*text*',
		run: (target) => target.chain().focus().toggleItalic().run(),
	},
	{
		name: 'link',
		icon: 'link',
		label: 'Link',
		keys: `${mod}K`,
		markdown: '[text](url)',
		run: openLink,
	},
	...(spoilers
		? [
				{
					name: 'spoiler',
					icon: 'eye-slash',
					label: 'Spoiler',
					keys: `${mod}Shift+S`,
					markdown: '||text||',
					run: (target) => target.chain().focus().toggleSpoiler().run(),
				} satisfies Tool,
			]
		: []),
	{
		name: 'bulletList',
		icon: 'list-bullets',
		label: 'Bulleted list',
		keys: `${mod}Shift+8`,
		markdown: '- ',
		run: (target) => target.chain().focus().toggleBulletList().run(),
	},
	{
		name: 'orderedList',
		icon: 'list-numbers',
		label: 'Numbered list',
		keys: `${mod}Shift+7`,
		markdown: '1. ',
		run: (target) => target.chain().focus().toggleOrderedList().run(),
	},
	{
		name: 'blockquote',
		icon: 'quotes',
		label: 'Quote',
		keys: `${mod}Shift+B`,
		markdown: '> ',
		run: (target) => target.chain().focus().toggleBlockquote().run(),
	},
])

/** Tool names double as Tiptap mark and node names. */
let pressed = $derived.by((): Record<string, boolean> => {
	void revision
	return Object.fromEntries(tools.map((tool) => [tool.name, !!editor?.isActive(tool.name)]))
})

// Roving tabindex: the toolbar is one tab stop; arrow keys move between buttons.
let focusIndex = $state(0)
let toolbar = $state<HTMLElement>()

function onToolbarKeydown(event: KeyboardEvent) {
	const last = tools.length - 1
	const next = {
		ArrowRight: focusIndex === last ? 0 : focusIndex + 1,
		ArrowLeft: focusIndex === 0 ? last : focusIndex - 1,
		Home: 0,
		End: last,
	}[event.key]
	if (next === undefined) return
	event.preventDefault()
	focusIndex = next
	toolbar?.querySelectorAll('button')[next]?.focus()
}

function openLink() {
	if (!editor) return
	linkDraft = editor.getAttributes('link').href ?? ''
	linkError = ''
	tick().then(() => linkInput?.select())
}

function closeLink() {
	linkDraft = undefined
	editor?.commands.focus()
}

function applyLink() {
	if (!editor || linkDraft === undefined) return
	const raw = linkDraft.trim()
	if (!raw) return removeLink()
	const href = /^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`
	if (!isSafeLink(href)) {
		linkError = 'Links must start with http:// or https://'
		return
	}
	const chain = editor.chain().focus()
	if (editor.state.selection.empty && !editor.isActive('link')) {
		chain.insertContent({ type: 'text', text: raw, marks: [{ type: 'link', attrs: { href } }] })
		chain.unsetMark('link')
	} else {
		chain.extendMarkRange('link').setLink({ href })
	}
	chain.run()
	linkDraft = undefined
}

function removeLink() {
	editor?.chain().focus().extendMarkRange('link').unsetLink().run()
	linkDraft = undefined
}

function onLinkKeydown(event: KeyboardEvent) {
	if (event.key === 'Enter') {
		event.preventDefault()
		applyLink()
	} else if (event.key === 'Escape') {
		event.preventDefault()
		closeLink()
	}
}
</script>

{#snippet labelText()}
	<!-- A contenteditable can't be the target of <label for>, so clicking focuses by hand. -->
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<span id={labelId} onclick={() => editor?.commands.focus()}>{label}</span>
{/snippet}

<div class="rich-text-editor">
	{#if label || description}
		<FieldLabel label={label ? labelText : undefined} {description} {descriptionId} {disabled} />
	{/if}

	<div class={['surface', { disabled, invalid: overLimit }]}>
		<div
			class="toolbar"
			role="toolbar"
			aria-label="Formatting"
			aria-controls={id}
			tabindex="-1"
			bind:this={toolbar}
			onkeydown={onToolbarKeydown}
		>
			{#each tools as tool, i (tool.name)}
				{#if tool.name === 'bulletList'}
					<span class="separator" aria-hidden="true"></span>
				{/if}
				<button
					type="button"
					class="tool"
					aria-label={tool.label}
					aria-pressed={pressed[tool.name]}
					title={`${tool.label} (${tool.keys}) · ${tool.markdown}`}
					tabindex={i === focusIndex ? 0 : -1}
					disabled={disabled || !editor}
					onmousedown={(event) => event.preventDefault()}
					onfocus={() => (focusIndex = i)}
					onclick={() => editor && tool.run(editor)}
				>
					<Icon name={tool.icon} width="20" height="20" />
				</button>
			{/each}
		</div>

		{#if linkDraft !== undefined}
			<div class="link-panel">
				<label class="visually-hidden" for={linkInputId}>Link URL</label>
				<input
					id={linkInputId}
					class="link-input"
					type="text"
					inputmode="url"
					autocomplete="off"
					spellcheck="false"
					placeholder="https://"
					aria-invalid={linkError ? true : undefined}
					aria-describedby={linkError ? `${linkInputId}--error` : undefined}
					bind:value={linkDraft}
					bind:this={linkInput}
					onkeydown={onLinkKeydown}
				/>
				<button type="button" class="button small primary" onclick={applyLink}>
					<span>Apply</span>
				</button>
				{#if pressed.link}
					<button type="button" class="button small" onclick={removeLink}>
						<span>Remove</span>
					</button>
				{/if}
				<button type="button" class="button small" onclick={closeLink}>
					<span>Cancel</span>
				</button>
				{#if linkError}
					<p id={`${linkInputId}--error`} class="link-error copy sm">{linkError}</p>
				{/if}
			</div>
		{/if}

		<div class="body" {id} {@attach mount}>
			{#if !editor}
				<!-- Server-rendered stand-in until the editor mounts. -->
				<RichText class="content" {value} />
			{/if}
		</div>
	</div>

	<div class="footer">
		<FieldMessage
			id={messageId}
			tone="critical"
			message={overLimit ? `Too long by ${graphemes - maxGraphemes!} characters` : undefined}
		/>
		{#if maxGraphemes !== undefined}
			<span id={countId} class={['count', { over: overLimit }]}>
				{graphemes.toLocaleString()} / {maxGraphemes.toLocaleString()}
			</span>
		{/if}
	</div>

	{#if name}
		<input type="hidden" {name} value={JSON.stringify(value)} />
	{/if}
</div>

<style>
.rich-text-editor {
	display: grid;
	gap: 8px;
}

.surface {
	display: grid;
	background: var(--color-grey-800);
	border: 1px solid var(--color-grey-700);
	border-radius: 4px;

	@supports (corner-shape: squircle) {
		border-radius: 8px;
		corner-shape: var(--corner-shape);
	}

	&:focus-within {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}

	&.invalid {
		border-color: var(--color-critical);
	}

	&.disabled {
		color: var(--color-muted);
	}
}

.toolbar {
	display: flex;
	flex-wrap: wrap;
	gap: 2px;
	align-items: center;
	padding: 4px;
	border-block-end: 1px solid var(--color-grey-700);
}

.separator {
	inline-size: 1px;
	block-size: 20px;
	margin-inline: 4px;
	background: var(--color-grey-700);
}

.tool {
	display: grid;
	place-items: center;
	inline-size: 36px;
	block-size: 36px;
	padding: 0;
	color: var(--color-grey-300);
	touch-action: manipulation;
	cursor: pointer;
	background: none;
	border: none;
	border-radius: 4px;
	transition: background-color 100ms ease-out;

	@supports (corner-shape: squircle) {
		border-radius: 8px;
		corner-shape: var(--corner-shape);
	}

	&:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: -2px;
	}

	&:disabled {
		cursor: default;
		opacity: 0.5;
	}

	&:hover:not(:disabled) {
		color: var(--color-grey-050);
		background: var(--color-grey-700);
	}

	&[aria-pressed='true'] {
		color: var(--color-grey-950);
		background: var(--color-grey-200);
	}
}

.link-panel {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	align-items: center;
	padding: 8px;
	border-block-end: 1px solid var(--color-grey-700);
}

.link-input {
	flex: 1 1 12rem;
	min-inline-size: 0;
	padding: 6px 10px;
	font-family: inherit;

	/* 16px+ keeps iOS from zooming in on focus. */
	font-size: 1rem;
	color: var(--color-text);
	background: var(--color-grey-600);
	border: none;
	border-radius: 4px;

	&:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	&[aria-invalid='true'] {
		outline: 2px solid var(--color-critical);
	}
}

.link-error {
	flex-basis: 100%;
	color: var(--color-critical);
}

.body {
	display: grid;

	/* Content is created by Tiptap, outside Svelte's scoping. */
	:global(.content) {
		min-block-size: 8lh;
		padding: 12px;
		cursor: text;
		outline: none;
	}

	:global(.content .is-editor-empty:first-child::before) {
		float: inline-start;
		block-size: 0;
		color: var(--color-grey-500);
		pointer-events: none;
		content: attr(data-placeholder);
	}

	:global(.content .spoiler) {
		outline: 1px dashed var(--color-grey-400);
		background-color: var(--color-grey-700);
	}
}

.footer {
	display: flex;
	gap: 16px;
	align-items: baseline;
	justify-content: space-between;
}

.count {
	margin-inline-start: auto;
	font-size: 0.8125rem;
	font-variant-numeric: tabular-nums;
	color: var(--color-grey-400);

	&.over {
		color: var(--color-critical);
	}
}

.visually-hidden {
	position: absolute;
	inline-size: 1px;
	block-size: 1px;
	overflow: hidden;
	white-space: nowrap;
	clip-path: inset(50%);
}
</style>
