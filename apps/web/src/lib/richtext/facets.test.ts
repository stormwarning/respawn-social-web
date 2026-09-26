import { describe, expect, it } from 'vitest'
import { countGraphemes, normalize, parse, serialize, utf8Length } from './facets'
import { seededRandom } from './scramble'
import type { RichDoc, RichInline } from './types'

const NSID = 'social.respawn.richtext.facet'

const text = (
	value: string,
	...marks: NonNullable<Extract<RichInline, { type: 'text' }>['marks']>
) =>
	marks.length
		? { type: 'text' as const, text: value, marks }
		: { type: 'text' as const, text: value }
const p = (...content: RichInline[]) => ({ type: 'paragraph' as const, content })
const item = (...content: RichInline[]) => ({ type: 'listItem' as const, content: [p(...content)] })
const doc = (...content: RichDoc['content']): RichDoc => ({ type: 'doc', content })
const br = { type: 'hardBreak' as const }
const bold = { type: 'bold' as const }
const italic = { type: 'italic' as const }
const spoiler = { type: 'spoiler' as const }
const link = (href: string) => ({ type: 'link' as const, attrs: { href } })

function slice(value: string, start: number, end: number) {
	return new TextDecoder().decode(new TextEncoder().encode(value).slice(start, end))
}

describe('utf8Length', () => {
	it('matches TextEncoder', () => {
		for (const value of ['', 'abc', 'café', '日本語', '👍🏽 ok', '\ud800x']) {
			expect(utf8Length(value)).toBe(new TextEncoder().encode(value).length)
		}
	})
})

describe('countGraphemes', () => {
	it('counts user-perceived characters', () => {
		expect(countGraphemes('👍🏽a')).toBe(2)
		expect(countGraphemes('👨‍👩‍👧')).toBe(1)
	})
})

describe('serialize', () => {
	it('annotates inline marks by UTF-8 byte offset', () => {
		const value = serialize(doc(p(text('Café '), text('très', bold), text(' bien'))))
		expect(value.text).toBe('Café très bien')
		expect(value.textWithSpoilers).toBeUndefined()
		expect(value.facets).toEqual([
			{ index: { byteStart: 6, byteEnd: 11 }, features: [{ $type: `${NSID}#bold` }] },
		])
		expect(slice(value.text, 6, 11)).toBe('très')
	})

	it('merges touching spans with the same mark', () => {
		const value = serialize(doc(p(text('ab', bold), text('cd', bold, italic))))
		expect(value.facets).toEqual([
			{ index: { byteStart: 0, byteEnd: 4 }, features: [{ $type: `${NSID}#bold` }] },
			{ index: { byteStart: 2, byteEnd: 4 }, features: [{ $type: `${NSID}#italic` }] },
		])
	})

	it('keeps adjacent links with different targets apart', () => {
		const value = serialize(
			doc(p(text('a', link('https://a.test/')), text('b', link('https://b.test/')))),
		)
		expect(value.facets).toHaveLength(2)
	})

	it('drops unsafe links', () => {
		const value = serialize(doc(p(text('x', link('javascript:alert(1)')))))
		expect(value.facets).toEqual([])
	})

	it('lays out blocks with blank lines and list items with single newlines', () => {
		const value = serialize(
			doc(
				p(text('Intro'), br, text('second line')),
				{ type: 'bulletList', content: [item(text('one')), item(text('two'))] },
				{ type: 'blockquote', content: [p(text('quoted')), p(text('more'))] },
				{ type: 'orderedList', content: [item(text('first'))] },
			),
		)
		expect(value.text).toBe('Intro\nsecond line\n\none\ntwo\n\nquoted\n\nmore\n\nfirst')
		expect(value.facets).toEqual([
			{ index: { byteStart: 19, byteEnd: 22 }, features: [{ $type: `${NSID}#listItem` }] },
			{ index: { byteStart: 23, byteEnd: 26 }, features: [{ $type: `${NSID}#listItem` }] },
			{ index: { byteStart: 28, byteEnd: 40 }, features: [{ $type: `${NSID}#blockquote` }] },
			{
				index: { byteStart: 42, byteEnd: 47 },
				features: [{ $type: `${NSID}#listItem`, ordered: true }],
			},
		])
	})

	it('drops empty blocks and trailing hard breaks', () => {
		const value = serialize(
			doc(
				p(),
				p(text('a'), br, br),
				p(text('   ')),
				{ type: 'bulletList', content: [item()] },
				p(text('b')),
			),
		)
		expect(value.text).toBe('a\n\nb')
		expect(value.facets).toEqual([])
	})

	it('scrambles spoilers in text while keeping byte offsets', () => {
		const value = serialize(
			doc(p(text('The '), text('butler did it 🔪', spoiler), text('!'))),
			seededRandom(1),
		)
		expect(value.textWithSpoilers).toBe('The butler did it 🔪!')
		expect(value.text).not.toBe(value.textWithSpoilers)
		expect(value.text.startsWith('The ')).toBe(true)
		expect(value.text.endsWith('!')).toBe(true)
		expect(utf8Length(value.text)).toBe(utf8Length(value.textWithSpoilers!))
		expect(value.text.split(' ')).toHaveLength(5)
	})
})

describe('parse', () => {
	const cases: [string, RichDoc][] = [
		['plain paragraph', doc(p(text('Hello')))],
		[
			'nested marks',
			doc(p(text('a'), text('b', bold), text('c', bold, italic), text('d', italic))),
		],
		[
			'link with bold inside',
			doc(p(text('go ', link('https://x.test/')), text('here', link('https://x.test/'), bold))),
		],
		['hard breaks', doc(p(text('line 1'), br, text('line 2')))],
		[
			'lists',
			doc(
				{ type: 'bulletList', content: [item(text('a')), item(text('b', italic))] },
				{ type: 'orderedList', content: [item(text('1')), item(text('2'), br, text('2b'))] },
			),
		],
		[
			'two lists of the same kind',
			doc(
				{ type: 'bulletList', content: [item(text('a'))] },
				{ type: 'bulletList', content: [item(text('b'))] },
			),
		],
		[
			'blockquote with list',
			doc(
				p(text('before')),
				{
					type: 'blockquote',
					content: [
						p(text('q')),
						{ type: 'bulletList', content: [item(text('x')), item(text('y'))] },
					],
				},
				p(text('after')),
			),
		],
		['spoiler', doc(p(text('it was '), text('Rosebud', spoiler)))],
		['emoji offsets', doc(p(text('🎮 '), text('ñ', bold), text(' 日本', italic)))],
	]

	it.each(cases)('round-trips %s', (_, input) => {
		expect(parse(serialize(input))).toEqual(input)
	})

	it('reads spoilers from textWithSpoilers', () => {
		const value = serialize(doc(p(text('secret', spoiler))), seededRandom(2))
		expect(parse(value)).toEqual(doc(p(text('secret', spoiler))))
	})

	it('falls back to text when textWithSpoilers does not line up', () => {
		const result = parse({
			text: 'shown',
			textWithSpoilers: 'longer text',
			facets: [{ index: { byteStart: 0, byteEnd: 5 }, features: [{ $type: `${NSID}#spoiler` }] }],
		})
		expect(result).toEqual(doc(p(text('shown', spoiler))))
	})

	it('ignores invalid, mid-character and unknown facets', () => {
		const result = parse({
			text: 'é ok',
			facets: [
				{ index: { byteStart: 1, byteEnd: 3 }, features: [{ $type: `${NSID}#bold` }] },
				{ index: { byteStart: 3, byteEnd: 99 }, features: [{ $type: `${NSID}#bold` }] },
				{ index: { byteStart: 3, byteEnd: 3 }, features: [{ $type: `${NSID}#bold` }] },
				{
					index: { byteStart: 3, byteEnd: 5 },
					features: [{ $type: 'app.bsky.richtext.facet#tag' } as never],
				},
				{
					index: { byteStart: 3, byteEnd: 5 },
					features: [{ $type: `${NSID}#link`, uri: 'javascript:x' }],
				},
				// @ts-expect-error untrusted input
				{ index: { byteStart: '0', byteEnd: 2 }, features: [{ $type: `${NSID}#bold` }] },
			],
		})
		expect(result).toEqual(doc(p(text('é ok'))))
	})

	it('handles facet-less text from other clients', () => {
		expect(parse({ text: 'para one\nstill one\n\n\npara two' })).toEqual(
			doc(p(text('para one'), br, text('still one')), p(text('para two'))),
		)
	})

	it('returns an empty document for empty text', () => {
		expect(parse({ text: '' })).toEqual(doc())
	})
})

describe('normalize', () => {
	it('is stable', () => {
		const once = normalize({
			text: 'a b\n\nc',
			facets: [
				{ index: { byteStart: 0, byteEnd: 3 }, features: [{ $type: `${NSID}#bold` }] },
				{ index: { byteStart: 5, byteEnd: 6 }, features: [{ $type: `${NSID}#blockquote` }] },
			],
		})
		expect(normalize(once)).toEqual(once)
	})
})
