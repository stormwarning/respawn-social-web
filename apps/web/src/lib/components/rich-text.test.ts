import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import { serialize } from '$lib/richtext/facets'
import type { RichDoc } from '$lib/richtext/types'
import RichText from './rich-text.svelte'

const NSID = 'social.respawn.richtext.facet'

describe('rich-text', () => {
	it('renders formatting without adding whitespace', () => {
		const { container } = render(RichText, {
			value: {
				text: 'a bold link.',
				facets: [
					{ index: { byteStart: 2, byteEnd: 6 }, features: [{ $type: `${NSID}#bold` }] },
					{
						index: { byteStart: 4, byteEnd: 11 },
						features: [{ $type: `${NSID}#link`, uri: 'https://example.com/' }],
					},
				],
			},
		})
		const paragraph = container.querySelector('p')!
		expect(paragraph.innerHTML.replace(/<!---->/g, '')).toBe(
			'a <strong>bo</strong><a rel="nofollow ugc noopener noreferrer" target="_blank" href="https://example.com/"><strong>ld</strong> link</a>.',
		)
	})

	it('renders lists and quotes', () => {
		const doc: RichDoc = {
			type: 'doc',
			content: [
				{
					type: 'orderedList',
					content: [
						{
							type: 'listItem',
							content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one' }] }],
						},
						{
							type: 'listItem',
							content: [{ type: 'paragraph', content: [{ type: 'text', text: 'two' }] }],
						},
					],
				},
				{
					type: 'blockquote',
					content: [{ type: 'paragraph', content: [{ type: 'text', text: 'quoted' }] }],
				},
			],
		}
		const { container } = render(RichText, { value: serialize(doc) })
		expect([...container.querySelectorAll('ol > li')].map((li) => li.textContent)).toEqual([
			'one',
			'two',
		])
		expect(container.querySelector('blockquote > p')).toHaveTextContent('quoted')
	})

	it('hides spoilers until activated', async () => {
		const value = serialize({
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [
						{ type: 'text', text: 'It was ' },
						{ type: 'text', text: 'his sled', marks: [{ type: 'spoiler' }] },
					],
				},
			],
		})
		const { container, getByRole } = render(RichText, { value })
		expect(container).not.toHaveTextContent('his sled')

		const spoiler = getByRole('button', { name: /spoiler/i })
		await fireEvent.keyDown(spoiler, { key: 'Enter' })
		expect(container).toHaveTextContent('It was his sled')
		expect(spoiler).not.toHaveAttribute('role')
	})
})
