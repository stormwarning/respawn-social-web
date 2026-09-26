/**
 * Replacement code point ranges keyed by UTF-8 width. Swapping each character
 * for one of the same width keeps byte offsets — and therefore facets — valid
 * for both the scrambled and original text. UTF-16 length is preserved too.
 */
const POOLS: Record<1 | 2 | 3 | 4, [number, number]> = {
	1: [0x61, 0x7a], // a–z
	2: [0xe0, 0xf6], // à–ö
	3: [0x2591, 0x2593], // ░▒▓
	4: [0x1f0a1, 0x1f0ae], // 🂡–🂮
}

function utf8Width(codePoint: number): 1 | 2 | 3 | 4 {
	if (codePoint < 0x80) return 1
	if (codePoint < 0x800) return 2
	if (codePoint < 0x10000) return 3
	return 4
}

/** Replace every non-whitespace character with a random one of the same UTF-8 width. */
export function scramble(input: string, random: () => number = Math.random): string {
	let out = ''
	for (const char of input) {
		if (/\s/u.test(char)) {
			out += char
			continue
		}
		const [min, max] = POOLS[utf8Width(char.codePointAt(0)!)]
		out += String.fromCodePoint(min + Math.floor(random() * (max - min + 1)))
	}
	return out
}

/** Deterministic PRNG (mulberry32), so server and client render the same filler. */
export function seededRandom(seed: number): () => number {
	let state = seed >>> 0
	return () => {
		state = (state + 0x6d2b79f5) >>> 0
		let t = state
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}
