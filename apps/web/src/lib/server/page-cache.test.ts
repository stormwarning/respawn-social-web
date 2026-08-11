import { describe, expect, it, vi } from 'vitest'

import { cachePageData } from './page-cache'

describe('cachePageData', () => {
	it('lets the browser hold a page the viewer cannot change', () => {
		const setHeaders = vi.fn()
		cachePageData(setHeaders, { viewerCanMutate: false })
		expect(setHeaders).toHaveBeenCalledWith({ 'cache-control': 'private, max-age=60' })
	})

	it('sets nothing when the viewer can change the page', () => {
		const setHeaders = vi.fn()
		cachePageData(setHeaders, { viewerCanMutate: true })
		expect(setHeaders).not.toHaveBeenCalled()
	})

	it('never allows a shared cache to hold the response', () => {
		const setHeaders = vi.fn()
		cachePageData(setHeaders, { viewerCanMutate: false })
		const [[{ 'cache-control': value }]] = setHeaders.mock.calls
		expect(value).toContain('private')
		expect(value).not.toContain('public')
	})
})
