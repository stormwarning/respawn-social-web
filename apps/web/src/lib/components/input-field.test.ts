import { render } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'
import { describe, expect, it } from 'vitest'
import InputField, { type FieldAttrs } from './input-field.svelte'

function inputSnippet() {
	return createRawSnippet<[FieldAttrs]>((getAttrs) => ({
		render() {
			const attrs = Object.entries(getAttrs())
				.filter(([, value]) => value !== undefined)
				.map(([name, value]) => `${name}="${value}"`)
			return `<input type="text" ${attrs.join(' ')} />`
		},
	}))
}

function renderField(props: Record<string, unknown> = {}) {
	const { container } = render(InputField, { children: inputSnippet(), ...props })
	const input = container.querySelector('input')
	expect(input).not.toBeNull()
	return { container, input: input as HTMLInputElement }
}

describe('input-field', () => {
	it('links the label to the field element', () => {
		const { container, input } = renderField({ id: 'name', label: 'Name' })
		expect(input.id).toBe('name')
		expect(container.querySelector('label')).toHaveAttribute('for', 'name')
	})

	it('generates an id when none is given', () => {
		const { container, input } = renderField({ label: 'Name' })
		expect(input.id).not.toBe('')
		expect(container.querySelector('label')).toHaveAttribute('for', input.id)
	})

	it('describes the field by its message', () => {
		const { container, input } = renderField({ id: 'name', message: 'Required' })
		expect(input).toHaveAttribute('aria-describedby', 'name--message')
		expect(container.querySelector('#name--message')).toHaveTextContent('Required')
	})

	it('describes the field by its description', () => {
		const { container, input } = renderField({ id: 'name', description: 'Your full name' })
		expect(input).toHaveAttribute('aria-describedby', 'name--description')
		expect(container.querySelector('#name--description')).toHaveTextContent('Your full name')
	})

	it('merges a user-supplied aria-describedby with message and description', () => {
		const { input } = renderField({
			id: 'name',
			message: 'Required',
			description: 'Your full name',
			'aria-describedby': 'extra',
		})
		expect(input).toHaveAttribute('aria-describedby', 'extra name--message name--description')
	})

	it('has no aria-describedby without a message or description', () => {
		const { input } = renderField({ id: 'name', label: 'Name' })
		expect(input).not.toHaveAttribute('aria-describedby')
	})

	it('marks the field invalid on critical tone', () => {
		const { input } = renderField({ id: 'name', message: 'Required', tone: 'critical' })
		expect(input).toHaveAttribute('aria-invalid', 'true')
	})

	it('is not marked invalid on other tones', () => {
		const { input } = renderField({ id: 'name', message: 'Saved', tone: 'positive' })
		expect(input).not.toHaveAttribute('aria-invalid')
	})

	it('passes disabled down and hides the message', () => {
		const { container, input } = renderField({
			id: 'name',
			message: 'Required',
			disabled: true,
		})
		expect(input).toHaveAttribute('disabled')
		expect(input).not.toHaveAttribute('aria-describedby')
		expect(container.querySelector('#name--message')?.textContent?.trim()).toBe('')
	})
})
