import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import YearMenu from './year-menu.svelte'

describe('year menu', () => {
	it('lists every decade back to the first, newest first', () => {
		const { getAllByRole } = render(YearMenu, { filters: {}, thisYear: 2026 })
		const decades = getAllByRole('link', { name: /^\d{4}s$/ }).map((a) => a.textContent?.trim())
		expect(decades[0]).toBe('2020s')
		expect(decades.at(-1)).toBe('1950s')
		expect(decades).toHaveLength(8)
	})

	it('opens on the current decade and stops one year past this one', () => {
		const { getAllByRole, queryByRole } = render(YearMenu, { filters: {}, thisYear: 2026 })
		const years = getAllByRole('link', { name: /^\d{4}$/ }).map((a) => a.textContent?.trim())
		expect(years).toEqual(['2020', '2021', '2022', '2023', '2024', '2025', '2026', '2027'])
		expect(queryByRole('link', { name: '2028' })).toBeNull()
	})

	it('opens on the selected year’s decade and marks it', () => {
		const { getByRole } = render(YearMenu, { filters: { year: 1998 }, thisYear: 2026 })
		expect(getByRole('link', { name: '1998' })).toHaveAttribute('aria-current', 'page')
		expect(getByRole('link', { name: '1990s' })).toHaveAttribute('aria-expanded', 'true')
		expect(getByRole('link', { name: '1999' })).toHaveAttribute('href', '/games/year/1999/')
	})

	it('marks a selected decade and labels the button with it', () => {
		const { getByRole, getByText } = render(YearMenu, { filters: { decade: 2010 }, thisYear: 2026 })
		expect(getByRole('link', { name: '2010s' })).toHaveAttribute('aria-current', 'page')
		expect(getByRole('link', { name: '2010s' })).toHaveAttribute('href', '/games/decade/2010s/')
		expect(getByText('2010s', { selector: 'summary span' })).toBeInTheDocument()
	})

	it('marks "All years" when nothing is selected', () => {
		const { getByRole } = render(YearMenu, { filters: {}, thisYear: 2026 })
		expect(getByRole('link', { name: 'All years' })).toHaveAttribute('aria-current', 'page')
	})
})
