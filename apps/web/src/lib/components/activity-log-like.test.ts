import { render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import ActivityLogLike from './activity-log-like.svelte'

vi.mock('$app/state', () => ({ page: { data: { user: { did: 'did:plc:me' } } } }))

const sam = { did: 'did:plc:sam', name: 'Sam', url: '/sam.test/' }
const me = { did: 'did:plc:me', name: 'Me', url: '/me.test/' }
const game = { igdbId: 1, slug: 'hades', title: 'Hades' }
const createdAt = '2026-10-01T00:00:00Z'

describe('activity-log-like', () => {
	it('names the author of the review', () => {
		const { container } = render(ActivityLogLike, {
			actor: me,
			log: {
				url: '/zed.test/game/hades/',
				author: { did: 'did:plc:zed', name: 'Zed', url: '/zed.test/' },
				record: { game, createdAt, review: { text: 'Great.' } },
			},
		})
		expect(container.textContent?.replace(/\s+/g, ' ').trim()).toMatch(
			/^You liked Zed’s review of Hades/,
		)
	})

	it('says "your review" when the viewer wrote it', () => {
		const { container } = render(ActivityLogLike, {
			actor: sam,
			log: {
				url: '/me.test/game/hades/2/',
				author: me,
				record: { game, createdAt, review: { text: '', external: { uri: 'https://x.test' } } },
			},
		})
		expect(container.textContent?.replace(/\s+/g, ' ')).toContain('Sam liked your review of Hades')
		expect(container.querySelector('.log-link')).toHaveAttribute('href', '/me.test/game/hades/2/')
	})
})
