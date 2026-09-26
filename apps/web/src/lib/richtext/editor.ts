import {
	Extension,
	InputRule,
	Mark,
	PasteRule,
	markInputRule,
	markPasteRule,
	mergeAttributes,
	type Extensions,
} from '@tiptap/core'
import { Blockquote } from '@tiptap/extension-blockquote'
import { Bold } from '@tiptap/extension-bold'
import { Document } from '@tiptap/extension-document'
import { HardBreak } from '@tiptap/extension-hard-break'
import { Italic } from '@tiptap/extension-italic'
import { Link } from '@tiptap/extension-link'
import { BulletList, ListItem, ListKeymap, OrderedList } from '@tiptap/extension-list'
import { Paragraph } from '@tiptap/extension-paragraph'
import { Text } from '@tiptap/extension-text'
import { Placeholder, UndoRedo } from '@tiptap/extensions'
import type { EditorState } from '@tiptap/pm/state'
import { isSafeLink } from './facets'

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		spoiler: {
			toggleSpoiler: () => ReturnType
		}
	}
}

/** `||hidden text||`, as on Discord. */
const spoilerInputRegex = /(?:^|\s)(\|\|(?!\s+\|\|)((?:[^|]+))\|\|(?!\s+\|\|))$/
const spoilerPasteRegex = /(?:^|\s)(\|\|(?!\s+\|\|)((?:[^|]+))\|\|(?!\s+\|\|))/g

export const Spoiler = Mark.create({
	name: 'spoiler',

	parseHTML() {
		return [{ tag: 'span[data-spoiler]' }]
	},

	renderHTML({ HTMLAttributes }) {
		return ['span', mergeAttributes(HTMLAttributes, { 'data-spoiler': '', class: 'spoiler' }), 0]
	},

	addCommands() {
		return {
			toggleSpoiler:
				() =>
				({ commands }) =>
					commands.toggleMark(this.name),
		}
	},

	addKeyboardShortcuts() {
		return {
			'Mod-Shift-s': () => this.editor.commands.toggleSpoiler(),
		}
	},

	addInputRules() {
		return [markInputRule({ find: spoilerInputRegex, type: this.type })]
	},

	addPasteRules() {
		return [markPasteRule({ find: spoilerPasteRegex, type: this.type })]
	},
})

/** `[label](https://…)` */
const markdownLinkInputRegex = /\[([^\]]+)\]\((\S+)\)$/
const markdownLinkPasteRegex = /\[([^\]]+)\]\((\S+?)\)/g

function replaceWithLink(
	state: EditorState,
	from: number,
	to: number,
	label: string,
	href: string,
) {
	const { link } = state.schema.marks
	state.tr.replaceWith(from, to, state.schema.text(label, [link.create({ href })]))
	state.tr.removeStoredMark(link)
}

const MarkdownLink = Link.extend({
	addInputRules() {
		return [
			new InputRule({
				find: markdownLinkInputRegex,
				handler: ({ state, range, match }) => {
					const [, label, href] = match
					if (!isSafeLink(href)) return null
					replaceWithLink(state, range.from, range.to, label, href)
				},
			}),
		]
	},

	addPasteRules() {
		return [
			...(this.parent?.() ?? []),
			new PasteRule({
				find: markdownLinkPasteRegex,
				handler: ({ state, range, match }) => {
					const [, label, href] = match
					if (!isSafeLink(href)) return null
					replaceWithLink(state, range.from, range.to, label, href)
				},
			}),
		]
	},
})

export interface EditorOptions {
	placeholder?: string
	spoilers?: boolean
	/** Called for Mod-K, so the host can open its link UI. */
	onLinkShortcut: () => void
}

/**
 * The editor schema: paragraphs, flat bullet/ordered lists, and blockquotes
 * (which may hold lists but not other blockquotes), with bold, italic, link
 * and optionally spoiler marks — exactly what facets can represent.
 */
export function createExtensions({
	placeholder,
	spoilers = true,
	onLinkShortcut,
}: EditorOptions): Extensions {
	return [
		Document,
		Paragraph,
		Text,
		HardBreak,
		Bold,
		Italic,
		MarkdownLink.configure({
			autolink: true,
			linkOnPaste: true,
			openOnClick: false,
			defaultProtocol: 'https',
			isAllowedUri: (url) => isSafeLink(url),
			HTMLAttributes: { rel: 'nofollow noopener noreferrer', target: null },
		}),
		Blockquote.extend({ content: '(paragraph | list)+' }),
		BulletList,
		OrderedList,
		ListItem.extend({ content: 'paragraph' }),
		ListKeymap,
		UndoRedo,
		Placeholder.configure({ placeholder }),
		...(spoilers ? [Spoiler] : []),
		Extension.create({
			name: 'linkShortcut',
			addKeyboardShortcuts() {
				return {
					'Mod-k': () => {
						onLinkShortcut()
						return true
					},
				}
			},
		}),
	]
}
