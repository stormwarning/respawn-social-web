import { scramble } from './scramble'
import type {
	Facet,
	FacetFeature,
	RichBlock,
	RichBlockquote,
	RichDoc,
	RichInline,
	RichList,
	RichListItem,
	RichMark,
	RichParagraph,
	RichText,
	RichTextValue,
} from './types'

/*
 * Plain-text layout, shared by serialize() and parse():
 *
 * - Top-level blocks, and blocks inside a blockquote, are separated by a blank line ("\n\n").
 * - List items are separated by a single "\n"; list markers are not part of the text.
 * - A hard break inside a paragraph or list item is a single "\n".
 *
 * Block structure is carried by `listItem` (one per item) and `blockquote` facets,
 * inline formatting by `bold`, `italic`, `spoiler` and `link` facets.
 */

const NSID = 'social.respawn.richtext.facet'

const LINK_PROTOCOLS = new Set(['http:', 'https:'])

/** Whether `uri` is a link we are willing to store and render. */
export function isSafeLink(uri: unknown): uri is `${string}:${string}` {
	if (typeof uri !== 'string') return false
	try {
		return LINK_PROTOCOLS.has(new URL(uri).protocol)
	} catch {
		return false
	}
}

/** UTF-8 byte length without allocating. Lone surrogates count as U+FFFD (3 bytes), like TextEncoder. */
export function utf8Length(value: string): number {
	let length = 0
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i)
		if (code < 0x80) length += 1
		else if (code < 0x800) length += 2
		else if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
			const next = value.charCodeAt(i + 1)
			if (next >= 0xdc00 && next <= 0xdfff) {
				length += 4
				i++
			} else length += 3
		} else length += 3
	}
	return length
}

const segmenter = new Intl.Segmenter()

export function countGraphemes(value: string): number {
	let count = 0
	for (const _ of segmenter.segment(value)) count++
	return count
}

// ---------------------------------------------------------------------------
// Serialize: document → text + facets
// ---------------------------------------------------------------------------

function isBlank(content: RichInline[] | undefined): boolean {
	return !content?.some((node) => node.type === 'text' && node.text.trim() !== '')
}

function tidyInline(content: RichInline[] | undefined): RichInline[] {
	const nodes: RichInline[] = []
	for (const node of content ?? []) {
		if (node.type === 'hardBreak') nodes.push(node)
		// A raw newline would be read back as a hard break or block separator.
		else if (node.text) nodes.push({ ...node, text: node.text.replace(/\r?\n/g, ' ') })
	}
	while (nodes[0]?.type === 'hardBreak') nodes.shift()
	while (nodes.at(-1)?.type === 'hardBreak') nodes.pop()
	return nodes
}

function tidyParagraph(paragraph: RichParagraph): RichParagraph | undefined {
	return isBlank(paragraph.content)
		? undefined
		: { type: 'paragraph', content: tidyInline(paragraph.content) }
}

function tidyList(list: RichList): RichList | undefined {
	const items: RichListItem[] = []
	for (const item of list.content) {
		// Items hold a single paragraph; fold any extras in with hard breaks.
		const content = item.content.flatMap((paragraph, i): RichInline[] =>
			i === 0
				? (paragraph.content ?? [])
				: [{ type: 'hardBreak' } as RichInline].concat(paragraph.content ?? []),
		)
		const paragraph = tidyParagraph({ type: 'paragraph', content })
		if (paragraph) items.push({ type: 'listItem', content: [paragraph] })
	}
	return items.length ? { type: list.type, content: items } : undefined
}

function tidyBlock(block: RichBlock): RichBlock | undefined {
	switch (block.type) {
		case 'paragraph':
			return tidyParagraph(block)
		case 'bulletList':
		case 'orderedList':
			return tidyList(block)
		case 'blockquote': {
			const content = block.content
				.map((child) => tidyBlock(child))
				.filter((child): child is RichParagraph | RichList => !!child)
			return content.length ? { type: 'blockquote', content } : undefined
		}
	}
}

/** Drop empty blocks and stray hard breaks so the document has one canonical text layout. */
export function tidy(doc: RichDoc): RichDoc {
	return {
		type: 'doc',
		content: doc.content.map((block) => tidyBlock(block)).filter((block) => !!block),
	}
}

interface Span {
	byteStart: number
	byteEnd: number
	charStart: number
	charEnd: number
}

interface FeatureSpan extends Span {
	key: string
	feature: FacetFeature
}

class Writer {
	text = ''
	bytes = 0
	spans: FeatureSpan[] = []
	#lastByKey = new Map<string, FeatureSpan>()

	append(value: string): Span {
		const start = { byteStart: this.bytes, charStart: this.text.length }
		this.text += value
		this.bytes += utf8Length(value)
		return { ...start, byteEnd: this.bytes, charEnd: this.text.length }
	}

	mark(): Pick<Span, 'byteStart' | 'charStart'> {
		return { byteStart: this.bytes, charStart: this.text.length }
	}

	since(start: Pick<Span, 'byteStart' | 'charStart'>): Span {
		return { ...start, byteEnd: this.bytes, charEnd: this.text.length }
	}

	/** Record a feature over `span`, extending the previous span with the same key when they touch. */
	annotate(span: Span, key: string, feature: FacetFeature) {
		const last = this.#lastByKey.get(key)
		if (last && last.byteEnd === span.byteStart) {
			last.byteEnd = span.byteEnd
			last.charEnd = span.charEnd
			return
		}
		const next = { ...span, key, feature }
		this.spans.push(next)
		this.#lastByKey.set(key, next)
	}
}

function markFeature(mark: RichMark): [key: string, feature: FacetFeature] | undefined {
	switch (mark.type) {
		case 'bold':
		case 'italic':
		case 'spoiler':
			return [mark.type, { $type: `${NSID}#${mark.type}` }]
		case 'link':
			if (!isSafeLink(mark.attrs.href)) return
			return [`link:${mark.attrs.href}`, { $type: `${NSID}#link`, uri: mark.attrs.href }]
	}
}

function writeInline(writer: Writer, content: RichInline[] = []) {
	for (const node of content) {
		if (node.type === 'hardBreak') {
			writer.append('\n')
			continue
		}
		const span = writer.append(node.text)
		for (const mark of node.marks ?? []) {
			const feature = markFeature(mark)
			if (feature) writer.annotate(span, ...feature)
		}
	}
}

function writeBlocks(writer: Writer, blocks: RichBlock[]) {
	blocks.forEach((block, i) => {
		if (i > 0) writer.append('\n\n')
		switch (block.type) {
			case 'paragraph':
				writeInline(writer, block.content)
				break
			case 'bulletList':
			case 'orderedList': {
				const ordered = block.type === 'orderedList'
				block.content.forEach((item, j) => {
					if (j > 0) writer.append('\n')
					const start = writer.mark()
					writeInline(writer, item.content[0]?.content)
					writer.annotate(writer.since(start), `listItem:${start.byteStart}`, {
						$type: `${NSID}#listItem`,
						...(ordered && { ordered: true }),
					})
				})
				break
			}
			case 'blockquote': {
				const start = writer.mark()
				writeBlocks(writer, block.content)
				writer.annotate(writer.since(start), `blockquote:${start.byteStart}`, {
					$type: `${NSID}#blockquote`,
				})
				break
			}
		}
	})
}

/**
 * Convert a document into record-ready rich text. Spoiler spans are scrambled
 * in `text` and kept intact in `textWithSpoilers`.
 */
export function serialize(doc: RichDoc, random: () => number = Math.random): RichTextValue {
	const writer = new Writer()
	writeBlocks(writer, tidy(doc).content)

	const spans = writer.spans.toSorted((a, b) => a.byteStart - b.byteStart || b.byteEnd - a.byteEnd)
	const facets: Facet[] = spans.map(({ byteStart, byteEnd, feature }) => ({
		index: { byteStart, byteEnd },
		features: [feature],
	}))

	const spoilers = spans.filter((span) => span.key === 'spoiler')
	if (!spoilers.length) return { text: writer.text, facets }

	let text = ''
	let cursor = 0
	for (const { charStart, charEnd } of spoilers) {
		text += writer.text.slice(cursor, charStart)
		text += scramble(writer.text.slice(charStart, charEnd), random)
		cursor = charEnd
	}
	text += writer.text.slice(cursor)
	return { text, textWithSpoilers: writer.text, facets }
}

// ---------------------------------------------------------------------------
// Parse: text + facets → document
// ---------------------------------------------------------------------------

interface Range {
	start: number
	end: number
}

interface InlineRange extends Range {
	mark: RichMark
}

interface ItemRange extends Range {
	ordered: boolean
}

/** Map every UTF-8 byte offset that starts a code point (plus the end) to its UTF-16 index; -1 elsewhere. */
function byteToCharMap(text: string): Int32Array {
	const map = new Int32Array(utf8Length(text) + 1).fill(-1)
	let byte = 0
	let char = 0
	for (const codePoint of text) {
		map[byte] = char
		byte += utf8Length(codePoint)
		char += codePoint.length
	}
	map[byte] = char
	return map
}

function readFacets(text: string, facets: unknown) {
	const map = byteToCharMap(text)
	const inline: InlineRange[] = []
	const quotes: Range[] = []
	const items: ItemRange[] = []

	if (!Array.isArray(facets)) return { inline, quotes, items }

	for (const facet of facets as Partial<Facet>[]) {
		const byteStart = facet?.index?.byteStart
		const byteEnd = facet?.index?.byteEnd
		if (!Number.isInteger(byteStart) || !Number.isInteger(byteEnd)) continue
		if (byteStart! < 0 || byteEnd! > map.length - 1 || byteStart! >= byteEnd!) continue
		const start = map[byteStart!]
		const end = map[byteEnd!]
		if (start < 0 || end < 0) continue // not on a code point boundary

		for (const feature of Array.isArray(facet.features) ? facet.features : []) {
			switch ((feature as { $type?: unknown })?.$type) {
				case `${NSID}#bold`:
					inline.push({ start, end, mark: { type: 'bold' } })
					break
				case `${NSID}#italic`:
					inline.push({ start, end, mark: { type: 'italic' } })
					break
				case `${NSID}#spoiler`:
					inline.push({ start, end, mark: { type: 'spoiler' } })
					break
				case `${NSID}#link`: {
					const uri = (feature as { uri?: unknown }).uri
					if (isSafeLink(uri))
						inline.push({ start, end, mark: { type: 'link', attrs: { href: uri } } })
					break
				}
				case `${NSID}#blockquote`:
					quotes.push({ start, end })
					break
				case `${NSID}#listItem`:
					items.push({ start, end, ordered: (feature as { ordered?: unknown }).ordered === true })
					break
			}
		}
	}
	return { inline, quotes, items }
}

/** Sort ranges and merge any that overlap. */
function mergeRanges(ranges: Range[]): Range[] {
	const merged: Range[] = []
	for (const range of ranges.toSorted((a, b) => a.start - b.start)) {
		const last = merged.at(-1)
		if (last && range.start < last.end) last.end = Math.max(last.end, range.end)
		else merged.push({ ...range })
	}
	return merged
}

const MARK_ORDER: RichMark['type'][] = ['link', 'spoiler', 'bold', 'italic']

function sameMarks(a: RichMark[] = [], b: RichMark[] = []): boolean {
	return (
		a.length === b.length &&
		a.every((mark, i) => {
			const other = b[i]
			return (
				mark.type === other.type &&
				(mark.type !== 'link' || (other.type === 'link' && mark.attrs.href === other.attrs.href))
			)
		})
	)
}

class Reader {
	constructor(
		readonly text: string,
		readonly inline: InlineRange[],
	) {}

	/** Inline nodes for text[start, end); newlines become hard breaks. */
	inlines(start: number, end: number): RichInline[] {
		const cuts = new Set([start, end])
		for (const range of this.inline) {
			if (range.start > start && range.start < end) cuts.add(range.start)
			if (range.end > start && range.end < end) cuts.add(range.end)
		}
		for (
			let i = this.text.indexOf('\n', start);
			i !== -1 && i < end;
			i = this.text.indexOf('\n', i + 1)
		) {
			cuts.add(i)
			cuts.add(i + 1)
		}
		const points = [...cuts].filter((point) => point <= end).toSorted((a, b) => a - b)

		const nodes: RichInline[] = []
		for (let i = 0; i < points.length - 1; i++) {
			const [from, to] = [points[i], points[i + 1]]
			if (from === to) continue
			const text = this.text.slice(from, to)
			if (text === '\n') {
				nodes.push({ type: 'hardBreak' })
				continue
			}
			const marks: RichMark[] = []
			for (const type of MARK_ORDER) {
				const range = this.inline.find(
					(candidate) =>
						candidate.mark.type === type && candidate.start <= from && candidate.end >= to,
				)
				if (range) marks.push(range.mark)
			}
			const last = nodes.at(-1)
			if (last?.type === 'text' && sameMarks(last.marks, marks)) {
				last.text += text
				continue
			}
			const node: RichText = { type: 'text', text }
			if (marks.length) node.marks = marks
			nodes.push(node)
		}
		return nodes
	}

	/** Paragraphs for text[start, end), split on blank lines. */
	paragraphs(start: number, end: number): RichParagraph[] {
		const paragraphs: RichParagraph[] = []
		const blankLine = /\n[^\S\n]*\n\s*/g
		blankLine.lastIndex = start
		let cursor = start
		const push = (from: number, to: number) => {
			while (from < to && this.text[from] === '\n') from++
			while (to > from && this.text[to - 1] === '\n') to--
			if (this.text.slice(from, to).trim()) {
				paragraphs.push({ type: 'paragraph', content: this.inlines(from, to) })
			}
		}
		for (
			let match = blankLine.exec(this.text);
			match && match.index < end;
			match = blankLine.exec(this.text)
		) {
			push(cursor, Math.min(match.index, end))
			cursor = Math.min(match.index + match[0].length, end)
		}
		push(cursor, end)
		return paragraphs
	}

	/** Paragraphs and lists for text[start, end), given the list items inside it. */
	blocks(start: number, end: number, items: ItemRange[]): (RichParagraph | RichList)[] {
		const blocks: (RichParagraph | RichList)[] = []
		let cursor = start
		let list: RichList | undefined
		for (const item of items) {
			const gap = this.text.slice(cursor, item.start)
			const type = item.ordered ? 'orderedList' : 'bulletList'
			// Items separated by a single line break continue the current list.
			const continues = list?.type === type && /^[^\S\n]*\n?[^\S\n]*$/.test(gap)
			if (!list || !continues) {
				blocks.push(...this.paragraphs(cursor, item.start))
				const next: RichList = { type, content: [] }
				blocks.push(next)
				list = next
			}
			const content = this.inlines(item.start, item.end)
			list.content.push({ type: 'listItem', content: [{ type: 'paragraph', content }] })
			cursor = item.end
		}
		blocks.push(...this.paragraphs(cursor, end))
		return blocks
	}
}

/**
 * Rebuild a document from record rich text. Invalid, overlapping or unknown
 * facets are dropped, as are links that aren't http(s).
 */
export function parse(value: RichTextValue): RichDoc {
	const { text: displayText, textWithSpoilers } = value
	const text =
		typeof textWithSpoilers === 'string' && utf8Length(textWithSpoilers) === utf8Length(displayText)
			? textWithSpoilers
			: displayText

	const { inline, quotes: rawQuotes, items: rawItems } = readFacets(text, value.facets)
	const quotes = mergeRanges(rawQuotes)

	// Keep list items that don't overlap each other or straddle a blockquote edge.
	const items: ItemRange[] = []
	for (const item of rawItems.toSorted((a, b) => a.start - b.start)) {
		const last = items.at(-1)
		if (last && item.start < last.end) continue
		const straddles = quotes.some(
			(quote) =>
				(item.start < quote.start && item.end > quote.start) ||
				(item.start < quote.end && item.end > quote.end),
		)
		if (!straddles) items.push(item)
	}
	const within = (start: number, end: number) =>
		items.filter((item) => item.start >= start && item.end <= end)

	const reader = new Reader(text, inline)
	const content: RichBlock[] = []
	let cursor = 0
	for (const quote of quotes) {
		content.push(...reader.blocks(cursor, quote.start, within(cursor, quote.start)))
		const children = reader.blocks(quote.start, quote.end, within(quote.start, quote.end))
		if (children.length)
			content.push({ type: 'blockquote', content: children } satisfies RichBlockquote)
		cursor = quote.end
	}
	content.push(...reader.blocks(cursor, text.length, within(cursor, text.length)))

	return { type: 'doc', content }
}

/** Parse and re-serialize untrusted rich text, e.g. before writing it to a PDS. */
export function normalize(value: RichTextValue, random?: () => number): RichTextValue {
	return serialize(parse(value), random)
}
