import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import FieldMessage from './field-message.svelte'

describe('field-message', () => {
	it('renders the message with the given id', () => {
		const { getByText } = render(FieldMessage, { id: 'name--message', message: 'Required' })
		expect(getByText('Required')).toHaveAttribute('id', 'name--message')
	})

	it('applies the tone as a class', () => {
		const { getByText } = render(FieldMessage, {
			id: 'msg',
			message: 'Required',
			tone: 'critical',
		})
		expect(getByText('Required')).toHaveClass('critical')
	})

	it('defaults to the neutral tone', () => {
		const { getByText } = render(FieldMessage, { id: 'msg', message: 'Required' })
		expect(getByText('Required')).toHaveClass('neutral')
	})

	it('hides the message but keeps its space when disabled', () => {
		const { container } = render(FieldMessage, {
			id: 'msg',
			message: 'Required',
			disabled: true,
		})
		const el = container.querySelector('.field-message')
		expect(el).not.toBeNull()
		expect(el).toHaveTextContent('')
		expect(el?.textContent).toBe('\u00a0')
	})

	it('reserves space when there is no message', () => {
		const { container } = render(FieldMessage, { id: 'msg' })
		expect(container.querySelector('.field-message')?.textContent).toBe('\u00a0')
	})

	it('renders nothing when space is not reserved and there is no message', () => {
		const { container } = render(FieldMessage, { id: 'msg', reserveMessageSpace: false })
		expect(container.querySelector('.field-message')).toBeNull()
	})
})
