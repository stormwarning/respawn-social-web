/** A page number to link, or a truncation marker between two distant numbers. */
export type PaginationItem = number | 'gap'

/**
 * The page numbers to show: always at most 5, always including the first and
 * last page, with the current page centered in the middle three when possible.
 * A hole of exactly one page renders that page rather than a pointless gap.
 */
export function paginationItems(page: number, totalPages: number): PaginationItem[] {
	if (totalPages <= 5) return range(1, totalPages)

	const mid = Math.min(Math.max(page, 3), totalPages - 2)
	const numbers = [1, mid - 1, mid, mid + 1, totalPages]

	const items: PaginationItem[] = [numbers[0]]
	for (let i = 1; i < numbers.length; i++) {
		const distance = numbers[i] - numbers[i - 1]
		if (distance === 2) items.push(numbers[i] - 1)
		else if (distance > 2) items.push('gap')
		items.push(numbers[i])
	}
	return items
}

function range(from: number, to: number): number[] {
	return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i)
}
