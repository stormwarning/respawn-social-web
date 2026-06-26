/**
 * Fix cover image URL protocol and target larger size image.
 */
export function normalizeCoverUrl(url: string): string {
	return url.replace(/^\/\//, 'https://').replace('/t_thumb/', '/t_cover_big/')
}
