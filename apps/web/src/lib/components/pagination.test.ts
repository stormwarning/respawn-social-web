import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import Pagination from './pagination.svelte'
import { paginationItems } from './pagination'

describe('paginationItems', () => {
	it('shows every page when there are five or fewer', () => {
		expect(paginationItems(1, 1)).toEqual([1])
		expect(paginationItems(3, 5)).toEqual([1, 2, 3, 4, 5])
	})

	it('truncates after the opening window on the first pages', () => {
		expect(paginationItems(1, 10)).toEqual([1, 2, 3, 4, 'gap', 10])
		expect(paginationItems(3, 10)).toEqual([1, 2, 3, 4, 'gap', 10])
	})

	it('centers the window on the current page in the middle', () => {
		expect(paginationItems(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10])
	})

	it('truncates before the closing window on the last pages', () => {
		expect(paginationItems(10, 10)).toEqual([1, 'gap', 7, 8, 9, 10])
		expect(paginationItems(8, 10)).toEqual([1, 'gap', 7, 8, 9, 10])
	})

	it('fills a hole of one page instead of truncating it', () => {
		expect(paginationItems(3, 6)).toEqual([1, 2, 3, 4, 5, 6])
		expect(paginationItems(4, 6)).toEqual([1, 2, 3, 4, 5, 6])
		expect(paginationItems(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
	})

	it('never renders more slots than the five-number window plus its gaps', () => {
		for (let total = 1; total <= 30; total++) {
			for (let page = 1; page <= total; page++) {
				expect(paginationItems(page, total).length).toBeLessThanOrEqual(7)
			}
		}
	})
})

describe('pagination', () => {
	const props = { page: 5, totalPages: 10, basePath: '/alice.test/backlog' }

	it('links page one to the canonical path and the rest to page URLs', () => {
		const { getByRole } = render(Pagination, props)
		expect(getByRole('link', { name: 'Page 1' })).toHaveAttribute('href', '/alice.test/backlog/')
		expect(getByRole('link', { name: 'Page 6' })).toHaveAttribute(
			'href',
			'/alice.test/backlog/page/6/',
		)
		expect(getByRole('link', { name: 'Previous page' })).toHaveAttribute(
			'href',
			'/alice.test/backlog/page/4/',
		)
	})

	it('marks the current page and does not link it', () => {
		const { container, queryByRole } = render(Pagination, props)
		const current = container.querySelector('[aria-current="page"]')
		expect(current).toHaveTextContent('5')
		expect(current?.tagName).toBe('SPAN')
		expect(queryByRole('link', { name: 'Page 5' })).toBeNull()
	})

	it('disables previous on the first page', () => {
		const { getByLabelText } = render(Pagination, { ...props, page: 1 })
		expect(getByLabelText('Previous page')).toHaveAttribute('aria-disabled', 'true')
	})

	it('disables next on the last page', () => {
		const { getByLabelText } = render(Pagination, { ...props, page: 10 })
		expect(getByLabelText('Next page')).toHaveAttribute('aria-disabled', 'true')
	})
})
