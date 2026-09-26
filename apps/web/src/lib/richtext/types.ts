import type { social } from '@respawn-social/lexicons'

export type Facet = social.respawn.richtext.facet.Main
export type FacetFeature = Facet['features'][number]

/** Rich text as stored in a record: plain text annotated by byte-indexed facets. */
export interface RichTextValue {
	/** Display text. Spoiler spans are scrambled here. */
	text: string
	/** Original text with spoiler spans intact. Only present when there are spoiler facets. */
	textWithSpoilers?: string
	facets?: Facet[]
}

/*
 * The document model shared by the editor, the facet (de)serializer and the
 * renderer. It is a strict subset of ProseMirror's JSON shape, so it can be
 * handed to and read from Tiptap without conversion.
 */

export type RichMark =
	| { type: 'bold' }
	| { type: 'italic' }
	| { type: 'spoiler' }
	| { type: 'link'; attrs: { href: string } }

export interface RichText {
	type: 'text'
	text: string
	marks?: RichMark[]
}

export interface RichHardBreak {
	type: 'hardBreak'
}

export type RichInline = RichText | RichHardBreak

export interface RichParagraph {
	type: 'paragraph'
	content?: RichInline[]
}

export interface RichListItem {
	type: 'listItem'
	content: RichParagraph[]
}

export interface RichBulletList {
	type: 'bulletList'
	content: RichListItem[]
}

export interface RichOrderedList {
	type: 'orderedList'
	content: RichListItem[]
}

export type RichList = RichBulletList | RichOrderedList

export interface RichBlockquote {
	type: 'blockquote'
	content: (RichParagraph | RichList)[]
}

export type RichBlock = RichParagraph | RichList | RichBlockquote

export interface RichDoc {
	type: 'doc'
	content: RichBlock[]
}
