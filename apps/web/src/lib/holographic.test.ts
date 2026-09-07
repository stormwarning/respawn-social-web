import { describe, expect, it } from 'vitest'

import { createHolographic, hashSeed, oklchToHex, toDataURI, toSVG } from './holographic'

const HEX = /^#[0-9a-f]{6}$/

describe('hashSeed', () => {
	it('is deterministic and distinguishes inputs', () => {
		expect(hashSeed('respawn')).toBe(hashSeed('respawn'))
		expect(hashSeed('respawn')).not.toBe(hashSeed('respawm'))
		expect(hashSeed('')).toBeGreaterThanOrEqual(0)
	})
})

describe('oklchToHex', () => {
	it('maps the achromatic extremes', () => {
		expect(oklchToHex(1, 0, 0)).toBe('#ffffff')
		expect(oklchToHex(0, 0, 0)).toBe('#000000')
	})

	it('converts a known mid value', () => {
		// oklch(62.8% 0.2577 29.23) ≈ #ff0000
		const hex = oklchToHex(0.628, 0.2577, 29.23)
		const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
		expect(r).toBeGreaterThanOrEqual(253)
		expect(g).toBeLessThanOrEqual(2)
		expect(b).toBeLessThanOrEqual(2)
	})

	it('pulls out-of-gamut chroma back into sRGB instead of clipping', () => {
		// Pastel with absurd chroma — should still be a light colour, not clipped to a primary.
		const hex = oklchToHex(0.9, 0.5, 200)
		const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
		expect(Math.min(r, g, b)).toBeGreaterThan(80)
	})
})

describe('createHolographic', () => {
	it('is deterministic per seed', () => {
		expect(createHolographic('zelda')).toEqual(createHolographic('zelda'))
	})

	it('varies across seeds', () => {
		const a = createHolographic('zelda')
		const b = createHolographic('hollow-knight')
		expect(a.base).not.toBe(b.base)
		expect(a.id).not.toBe(b.id)
	})

	it('produces values inside the documented ranges', () => {
		for (const seed of ['respawn', 'zelda', 'hollow-knight', 'a', '', 'did:plc:abc123']) {
			const spec = createHolographic(seed)
			expect(spec.seed).toBe(seed)
			expect(spec.base).toMatch(HEX)
			expect(Math.abs(spec.angle)).toBeGreaterThanOrEqual(10)
			expect(Math.abs(spec.angle)).toBeLessThanOrEqual(35)
			// 3–5 hue bands plus the highlight band.
			expect(spec.bands.length).toBeGreaterThanOrEqual(4)
			expect(spec.bands.length).toBeLessThanOrEqual(6)
			for (let i = 0; i < spec.bands.length; i++) {
				const band = spec.bands[i]
				expect(band.color).toMatch(HEX)
				expect(band.offset).toBeGreaterThanOrEqual(0)
				expect(band.offset).toBeLessThanOrEqual(1)
				expect(band.opacity).toBeGreaterThan(0)
				expect(band.opacity).toBeLessThanOrEqual(1)
				if (i > 0) expect(band.offset).toBeGreaterThanOrEqual(spec.bands[i - 1].offset)
			}
			expect(spec.sheen.color).toMatch(HEX)
			expect(spec.blur).toBeGreaterThanOrEqual(0.04)
			expect(spec.blur).toBeLessThanOrEqual(0.08)
			expect([1, -1]).toContain(spec.motion.direction)
			expect(spec.motion.duration).toBeGreaterThanOrEqual(18)
			expect(spec.motion.duration).toBeLessThanOrEqual(32)
		}
	})
})

describe('toSVG', () => {
	const spec = createHolographic('respawn')
	const svg = toSVG(spec, { width: 1200, height: 630 })

	it('is well-formed XML', () => {
		const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
		expect(doc.querySelector('parsererror')).toBeNull()
		expect(doc.documentElement.getAttribute('viewBox')).toBe('0 0 1200 630')
	})

	it('only uses features a non-browser rasteriser understands', () => {
		expect(svg).not.toContain('oklch(')
		expect(svg).not.toContain('var(')
		expect(svg).toContain('<feGaussianBlur')
	})

	it('namespaces ids by spec so several can share a document', () => {
		const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
		const ids = Array.from(doc.querySelectorAll('[id]')).map((el) => el.id)
		expect(ids.length).toBeGreaterThan(0)
		for (const id of ids) expect(id.startsWith(`h${spec.id}-`)).toBe(true)
		expect(new Set(ids).size).toBe(ids.length)
	})

	it('renders one blurred layer per band plus the sheen', () => {
		const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
		const group = doc.querySelector('g[filter]')
		expect(group?.querySelectorAll('rect').length).toBe(spec.bands.length + 1)
	})
})

describe('toDataURI', () => {
	it('is a CSS url() wrapping an SVG data URI with no raw unsafe characters', () => {
		const uri = toDataURI(createHolographic('respawn'))
		expect(uri.startsWith('url("data:image/svg+xml,')).toBe(true)
		expect(uri.endsWith('")')).toBe(true)
		const body = uri.slice('url("'.length, -'")'.length)
		expect(body).not.toMatch(/[<>#"\n]/)
	})
})
