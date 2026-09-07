/**
 * Seeded "holographic" gradient generator.
 *
 * Pure and isomorphic: no DOM, no Node APIs. A seed string is hashed into a
 * PRNG that drives every colour, angle, band position and motion parameter, so
 * the same seed always yields the same look and different seeds land anywhere
 * on the hue wheel.
 *
 * The single renderer is SVG (layered linear gradients under a gaussian blur).
 * Colours are computed in OKLCH for perceptual evenness but emitted as sRGB hex
 * so the output also rasterises outside a browser — the intended path for
 * generated OG images is `toSVG(spec, { width: 1200, height: 630 })` composed
 * with the logo path and text, then fed to resvg.
 *
 * In the browser use `toDataURI(spec)` as a `background-image`, masked by a
 * parent (`mask-image`) or clipped to text (`background-clip: text`).
 */

export type HolographicBand = {
	/** Centre of the band along the gradient axis, 0..1. */
	offset: number
	/** Half-width of the band along the axis, 0..1. */
	width: number
	/** sRGB hex. */
	color: string
	opacity: number
}

export type HolographicSheen = {
	angle: number
	offset: number
	width: number
	color: string
	opacity: number
}

export type HolographicMotion = {
	/** Seconds for one drift cycle. */
	duration: number
	direction: 1 | -1
	/** Percent of the layer's own size to translate. */
	drift: number
	/** Degrees of hue rotation at the far end of the cycle. */
	hueDrift: number
}

export type HolographicSpec = {
	seed: string
	/** Short hash of the seed; used to namespace SVG ids. */
	id: string
	/** Base fill, sRGB hex. */
	base: string
	/** Main band axis rotation in degrees (0 = vertical stripes). */
	angle: number
	/** Sorted by offset. */
	bands: HolographicBand[]
	sheen: HolographicSheen
	/** Blur radius as a fraction of min(width, height). */
	blur: number
	motion: HolographicMotion
}

export type HolographicSize = { width: number; height: number }

const DEFAULT_SIZE: HolographicSize = { width: 320, height: 320 }

/** 32-bit string hash (cyrb53 low word). Deterministic across runtimes. */
export function hashSeed(text: string): number {
	let h1 = 0xdeadbeef
	let h2 = 0x41c6ce57
	for (let i = 0; i < text.length; i++) {
		const ch = text.charCodeAt(i)
		h1 = Math.imul(h1 ^ ch, 2654435761)
		h2 = Math.imul(h2 ^ ch, 1597334677)
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
	h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
	h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
	return (h1 ^ h2) >>> 0
}

/** mulberry32: small, fast, good enough for visuals. Returns [0, 1). */
function createRng(seed: number): () => number {
	let a = seed >>> 0
	return () => {
		a = (a + 0x6d2b79f5) >>> 0
		let t = a
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

const range = (rng: () => number, min: number, max: number) => min + rng() * (max - min)
const sign = (rng: () => number): 1 | -1 => (rng() < 0.5 ? -1 : 1)

// —— Colour ————————————————————————————————————————————————————————————————

function linearToSrgb(x: number): number {
	const c = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055
	return Math.min(1, Math.max(0, c))
}

/** OKLCH → linear sRGB (unclamped), via OKLab. Björn Ottosson's matrices. */
function oklchToLinear(l: number, c: number, h: number): [number, number, number] {
	const hr = (h * Math.PI) / 180
	const a = c * Math.cos(hr)
	const b = c * Math.sin(hr)

	const lp = l + 0.3963377774 * a + 0.2158037573 * b
	const mp = l - 0.1055613458 * a - 0.0638541728 * b
	const sp = l - 0.0894841775 * a - 1.291485548 * b

	const L = lp * lp * lp
	const M = mp * mp * mp
	const S = sp * sp * sp

	return [
		4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
		-1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
		-0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
	]
}

const inGamut = (rgb: number[]) => rgb.every((v) => v >= -0.0005 && v <= 1.0005)

/**
 * OKLCH → sRGB hex. Chroma is reduced until the colour fits the sRGB gamut so
 * saturated pastels don't clip to a different hue.
 */
export function oklchToHex(l: number, c: number, h: number): string {
	let chroma = c
	let rgb = oklchToLinear(l, chroma, h)
	for (let i = 0; i < 40 && !inGamut(rgb); i++) {
		chroma *= 0.92
		rgb = oklchToLinear(l, chroma, h)
	}
	return (
		'#' +
		rgb
			.map((v) =>
				Math.round(linearToSrgb(v) * 255)
					.toString(16)
					.padStart(2, '0'),
			)
			.join('')
	)
}

// —— Spec ——————————————————————————————————————————————————————————————————

const BAND_HUE_OFFSETS = [60, 120, 180, 240, 300]

export function createHolographic(seed: string): HolographicSpec {
	const hash = hashSeed(seed)
	const rng = createRng(hash)

	// Draw order matters: every call below is part of the seed contract.
	const baseHue = rng() * 360
	const base = oklchToHex(range(rng, 0.78, 0.85), range(rng, 0.09, 0.14), baseHue)

	const angle = sign(rng) * range(rng, 10, 35)

	const bandCount = 3 + Math.floor(rng() * 3) // 3..5
	const hueOffsets = shuffle(rng, BAND_HUE_OFFSETS).slice(0, bandCount)
	const bands: HolographicBand[] = hueOffsets.map((hueOffset, i) => {
		const slot = 0.1 + (0.8 * (i + 0.5)) / bandCount
		return {
			offset: clamp01(slot + range(rng, -0.06, 0.06)),
			width: range(rng, 0.07, 0.2),
			color: oklchToHex(
				range(rng, 0.82, 0.9),
				range(rng, 0.13, 0.2),
				(baseHue + hueOffset + range(rng, -25, 25) + 360) % 360,
			),
			opacity: range(rng, 0.7, 1),
		}
	})
	// A near-white highlight band gives the "foil catching light" read.
	bands.push({
		offset: range(rng, 0.2, 0.8),
		width: range(rng, 0.04, 0.1),
		color: oklchToHex(0.96, 0.02, baseHue),
		opacity: range(rng, 0.5, 0.8),
	})
	bands.sort((a, b) => a.offset - b.offset)

	const sheen: HolographicSheen = {
		angle: sign(rng) * range(rng, 45, 80),
		offset: range(rng, 0.25, 0.75),
		width: range(rng, 0.15, 0.35),
		color: oklchToHex(0.97, 0.015, (baseHue + 180) % 360),
		opacity: range(rng, 0.2, 0.35),
	}

	const blur = range(rng, 0.04, 0.08)

	const motion: HolographicMotion = {
		duration: Math.round(range(rng, 18, 32)),
		direction: sign(rng),
		drift: Math.round(range(rng, 6, 12)),
		hueDrift: Math.round(range(rng, 6, 16)),
	}

	return {
		seed,
		id: hash.toString(36),
		base,
		angle,
		bands,
		sheen,
		blur,
		motion,
	}
}

function shuffle<T>(rng: () => number, input: readonly T[]): T[] {
	const out = input.slice()
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1))
		;[out[i], out[j]] = [out[j], out[i]]
	}
	return out
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

// —— SVG ———————————————————————————————————————————————————————————————————

const fmt = (n: number) => Number(n.toFixed(3)).toString()

function gradient(id: string, angle: number, band: HolographicBand | HolographicSheen): string {
	const from = fmt(clamp01(band.offset - band.width))
	const to = fmt(clamp01(band.offset + band.width))
	const mid = fmt(band.offset)
	return (
		`<linearGradient id="${id}" gradientTransform="rotate(${fmt(angle)} .5 .5)">` +
		`<stop offset="${from}" stop-color="${band.color}" stop-opacity="0"/>` +
		`<stop offset="${mid}" stop-color="${band.color}" stop-opacity="${fmt(band.opacity)}"/>` +
		`<stop offset="${to}" stop-color="${band.color}" stop-opacity="0"/>` +
		`</linearGradient>`
	)
}

/**
 * Render the spec as a standalone SVG document. Blurred layers are drawn
 * oversized so the blur never fades out at the edges of the viewport.
 */
export function toSVG(spec: HolographicSpec, size: HolographicSize = DEFAULT_SIZE): string {
	const { width, height } = size
	const p = `h${spec.id}-`
	const std = fmt(spec.blur * Math.min(width, height))

	// Bleed the blurred layers well past the viewport.
	const bx = fmt(-width * 0.25)
	const by = fmt(-height * 0.25)
	const bw = fmt(width * 1.5)
	const bh = fmt(height * 1.5)

	const defs =
		spec.bands.map((band, i) => gradient(`${p}b${i}`, spec.angle, band)).join('') +
		gradient(`${p}s`, spec.sheen.angle, spec.sheen) +
		`<filter id="${p}blur" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">` +
		`<feGaussianBlur stdDeviation="${std}"/>` +
		`</filter>`

	const layers =
		spec.bands
			.map(
				(_, i) => `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="url(#${p}b${i})"/>`,
			)
			.join('') + `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="url(#${p}s)"/>`

	return (
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="none">` +
		`<defs>${defs}</defs>` +
		`<rect width="${width}" height="${height}" fill="${spec.base}"/>` +
		`<g filter="url(#${p}blur)">${layers}</g>` +
		`</svg>`
	)
}

/**
 * CSS `url("data:image/svg+xml,…")` value for `background-image`/`mask-image`.
 * Only the characters that break a data URI are escaped, to keep it short.
 */
export function toDataURI(spec: HolographicSpec, size: HolographicSize = DEFAULT_SIZE): string {
	const svg = toSVG(spec, size)
		.replace(/%/g, '%25')
		.replace(/#/g, '%23')
		.replace(/</g, '%3C')
		.replace(/>/g, '%3E')
		.replace(/"/g, "'")
	return `url("data:image/svg+xml,${svg}")`
}
