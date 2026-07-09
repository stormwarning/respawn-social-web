/** Opaque feed cursor: base64url of `<created_at ms>|<uri>`. */
export function encodeCursor(createdAt: Date, uri: string): string {
	return Buffer.from(`${createdAt.getTime()}|${uri}`).toString('base64url')
}

export function decodeCursor(cursor: string): { createdAt: Date; uri: string } | null {
	try {
		const raw = Buffer.from(cursor, 'base64url').toString()
		const sep = raw.indexOf('|')
		if (sep === -1) return null
		const ms = Number(raw.slice(0, sep))
		if (!Number.isFinite(ms)) return null
		return { createdAt: new Date(ms), uri: raw.slice(sep + 1) }
	} catch {
		return null
	}
}
