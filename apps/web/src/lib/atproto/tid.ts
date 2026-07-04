const S32_CHARS = '234567abcdefghijklmnopqrstuvwxyz'

let lastTimestamp = 0n

/**
 * Generate a TID (timestamp identifier) record key: 13 chars of base32-sortable,
 * encoding 53 bits of microsecond timestamp + 10 bits of clock id. Needed when a
 * record's rkey must be known before writing — e.g. pairing a log with its gate
 * record inside one `applyWrites` batch.
 */
export function generateTid(): string {
	// Monotonic guard so two TIDs generated in the same millisecond still sort.
	let timestamp = BigInt(Date.now()) * 1000n
	if (timestamp <= lastTimestamp) timestamp = lastTimestamp + 1n
	lastTimestamp = timestamp

	const clockId = BigInt(Math.floor(Math.random() * 1024))
	let value = (timestamp << 10n) | clockId
	let tid = ''
	for (let i = 0; i < 13; i++) {
		tid = S32_CHARS[Number(value & 31n)] + tid
		value >>= 5n
	}
	return tid
}
