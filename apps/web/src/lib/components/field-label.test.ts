import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import FieldLabel from './field-label.svelte'

describe('field-label', () => {
	it('associates the label with the field via `for`', () => {
		const { getByText } = render(FieldLabel, { for: 'name', label: 'Name' })
		const label = getByText('Name').closest('label')
		expect(label).toHaveAttribute('for', 'name')
	})

	it('renders a span instead of a label when `for` is omitted', () => {
		const { getByText } = render(FieldLabel, { label: 'Name' })
		const el = getByText('Name')
		expect(el.closest('label')).toBeNull()
		expect(el.tagName).toBe('SPAN')
	})

	it('renders nothing without a label or description', () => {
		const { container } = render(FieldLabel, { for: 'name' })
		expect(container.querySelector('.field-label')).toBeNull()
	})

	it('renders the description with the given id', () => {
		const { getByText } = render(FieldLabel, {
			for: 'name',
			label: 'Name',
			description: 'Your full name',
			descriptionId: 'name--description',
		})
		expect(getByText('Your full name')).toHaveAttribute('id', 'name--description')
	})

	it('renders a description without a label', () => {
		const { getByText, container } = render(FieldLabel, {
			for: 'name',
			description: 'Your full name',
		})
		expect(getByText('Your full name')).toBeInTheDocument()
		expect(container.querySelector('label')).toBeNull()
	})

	it('renders the tertiary label', () => {
		const { getByText } = render(FieldLabel, {
			for: 'name',
			label: 'Name',
			tertiaryLabel: 'Optional',
		})
		expect(getByText('Optional')).toBeInTheDocument()
	})

	it('spreads extra attributes onto the root element', () => {
		const { container } = render(FieldLabel, {
			for: 'name',
			label: 'Name',
			'data-testid': 'my-label',
		})
		expect(container.querySelector('.field-label')).toHaveAttribute('data-testid', 'my-label')
	})
})
