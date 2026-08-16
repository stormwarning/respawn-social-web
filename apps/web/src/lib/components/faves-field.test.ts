import { fireEvent, render } from '@testing-library/svelte'
import { beforeAll, describe, expect, it } from 'vitest'
import FavesField, { type FaveDraft } from './faves-field.svelte'

// The tiles animate with `animate:flip`, which asks the element for its running
// animations; jsdom has no Web Animations API.
beforeAll(() => {
	Element.prototype.getAnimations ??= () => []
})

const draft = (igdbId: number): FaveDraft => ({
	igdbId,
	slug: `game-${igdbId}`,
	title: `Game ${igdbId}`,
	coverUrl: `https://pds.example/blob/${igdbId}`,
})

function renderField(value: FaveDraft[]) {
	const { container } = render(FavesField, { label: 'Favourite games', value })
	const hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement
	return { container, hidden, posted: () => JSON.parse(hidden.value) }
}

describe('faves-field', () => {
	it('posts the saved favourites unchanged', () => {
		const { hidden, posted } = renderField([draft(1), draft(2)])
		expect(hidden.name).toBe('faves')
		expect(posted()).toEqual([
			{ igdbId: 1, slug: 'game-1', title: 'Game 1', rawCoverUrl: null },
			{ igdbId: 2, slug: 'game-2', title: 'Game 2', rawCoverUrl: null },
		])
	})

	it('offers an empty slot until the maximum is reached', () => {
		const { container } = renderField([draft(1), draft(2), draft(3)])
		expect(container.querySelector('.add')).not.toBeNull()

		const { container: full } = renderField([draft(1), draft(2), draft(3), draft(4)])
		expect(full.querySelector('.add')).toBeNull()
	})

	it('drops a favourite when its clear button is pressed', async () => {
		const { container, posted } = renderField([draft(1), draft(2)])

		const clear = container.querySelectorAll('.clear')
		expect(clear).toHaveLength(2)
		await fireEvent.click(clear[0])

		expect(posted()).toEqual([{ igdbId: 2, slug: 'game-2', title: 'Game 2', rawCoverUrl: null }])
		expect(container.querySelectorAll('.clear')).toHaveLength(1)
	})
})
