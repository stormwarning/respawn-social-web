/**
 * Per-request stopwatch surfaced as a `Server-Timing` response header.
 *
 * Every page here renders from a chain of PDS / appview / PLC round trips, so
 * "the page is slow" is only actionable once you know which hop spent the time.
 * Marks show up in the devtools Network timing panel and in the header itself,
 * which also survives into Netlify function logs for the slow-request warning.
 */
export interface Timings {
	/** Time an async stage and return its result. */
	track<T>(name: string, fn: () => Promise<T>): Promise<T>
	/** Start a stage manually; call the returned function when it finishes. */
	start(name: string): () => void
	/** All recorded stages formatted as a `Server-Timing` header value. */
	header(): string
}

/** Server-Timing metric names must be HTTP tokens: no spaces, no separators. */
const toToken = (name: string) => name.replace(/[^A-Za-z0-9!#$%&'*+\-.^_`|~]/g, '_')

export function createTimings(): Timings {
	const marks: { name: string; dur: number }[] = []

	const start = (name: string) => {
		const t0 = performance.now()
		return () => {
			marks.push({ name: toToken(name), dur: performance.now() - t0 })
		}
	}

	return {
		start,
		async track<T>(name: string, fn: () => Promise<T>): Promise<T> {
			const stop = start(name)
			try {
				return await fn()
			} finally {
				stop()
			}
		},
		header() {
			return marks.map(({ name, dur }) => `${name};dur=${dur.toFixed(1)}`).join(', ')
		},
	}
}
