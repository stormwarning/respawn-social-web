import { fireEvent, render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import StarRating from './star-rating.svelte'

const fills = (container: HTMLElement) =>
	[...container.querySelectorAll<HTMLElement>('.star')].map((el) =>
		el.style.getPropertyValue('--fill'),
	)

describe('star-rating', () => {
	it('fills whole and half stars for the 0-10 value', () => {
		const { container } = render(StarRating, { value: 5 })
		expect(fills(container)).toEqual(['1', '1', '0.5', '0', '0'])
	})

	it('renders no fill when unrated', () => {
		const { container } = render(StarRating, { value: 0 })
		expect(fills(container)).toEqual(['0', '0', '0', '0', '0'])
	})

	it('exposes the rating to assistive tech', () => {
		const { getByRole } = render(StarRating, { value: 7, label: 'Your rating' })
		const slider = getByRole('slider', { name: 'Your rating' })
		expect(slider).toHaveAttribute('aria-valuenow', '7')
		expect(slider).toHaveAttribute('aria-valuetext', '3.5 stars')
		expect(slider).toHaveAttribute('aria-valuemax', '10')
	})

	it('says so when there is no rating', () => {
		const { getByRole } = render(StarRating, { value: 0 })
		expect(getByRole('slider')).toHaveAttribute('aria-valuetext', 'No rating')
	})

	it('previews half-star steps with the arrow keys without committing', async () => {
		const onchange = vi.fn()
		const { container, getByRole } = render(StarRating, { value: 4, onchange })
		const slider = getByRole('slider')
		await fireEvent.keyDown(slider, { key: 'ArrowRight' })
		expect(fills(container)).toEqual(['1', '1', '0.5', '0', '0'])
		expect(onchange).not.toHaveBeenCalled()
	})

	it('commits the previewed rating on Enter', async () => {
		const onchange = vi.fn()
		const { getByRole } = render(StarRating, { value: 4, onchange })
		const slider = getByRole('slider')
		await fireEvent.keyDown(slider, { key: 'ArrowRight' })
		await fireEvent.keyDown(slider, { key: 'Enter' })
		expect(onchange).toHaveBeenCalledExactlyOnceWith(5)
		expect(slider).toHaveAttribute('aria-valuenow', '5')
	})

	it('marks the previewed star as hovered', async () => {
		const { container, getByRole } = render(StarRating, { value: 0 })
		await fireEvent.keyDown(getByRole('slider'), { key: 'ArrowRight' })
		const hovered = [...container.querySelectorAll('.star')].map((el) =>
			el.hasAttribute('data-is-hovered'),
		)
		expect(hovered).toEqual([true, false, false, false, false])
	})

	it('drops an uncommitted preview on blur', async () => {
		const onchange = vi.fn()
		const { container, getByRole } = render(StarRating, { value: 4, onchange })
		const slider = getByRole('slider')
		await fireEvent.keyDown(slider, { key: 'ArrowRight' })
		await fireEvent.blur(slider)
		expect(fills(container)).toEqual(['1', '1', '0', '0', '0'])
		expect(onchange).not.toHaveBeenCalled()
	})

	it('clamps the preview to the 0-10 range', async () => {
		const onchange = vi.fn()
		const { container, getByRole } = render(StarRating, { value: 10, onchange })
		const slider = getByRole('slider')
		await fireEvent.keyDown(slider, { key: 'ArrowRight' })
		await fireEvent.keyDown(slider, { key: 'Enter' })
		expect(onchange).not.toHaveBeenCalled()
		expect(fills(container)).toEqual(['1', '1', '1', '1', '1'])
	})

	it('ignores keyboard input when disabled', async () => {
		const onchange = vi.fn()
		const { getByRole } = render(StarRating, { value: 4, disabled: true, onchange })
		await fireEvent.keyDown(getByRole('slider'), { key: 'ArrowRight' })
		expect(onchange).not.toHaveBeenCalled()
	})
})
