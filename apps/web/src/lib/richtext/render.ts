import type { RichInline } from './types'

export interface LinkRun {
	href?: string
	nodes: RichInline[]
}

export interface SpoilerRun {
	spoiler: boolean
	runs: LinkRun[]
}

function linkOf(node: RichInline): string | undefined {
	if (node.type !== 'text') return
	const mark = node.marks?.find((candidate) => candidate.type === 'link')
	return mark?.type === 'link' ? mark.attrs.href : undefined
}

function isSpoiler(node: RichInline): boolean {
	return node.type === 'text' && !!node.marks?.some((mark) => mark.type === 'spoiler')
}

/**
 * Group inline nodes so a spoiler or link spanning several differently
 * formatted nodes renders as one element. Spoilers wrap links, so a hidden
 * spoiler never contains a live link.
 */
export function groupInline(content: RichInline[] = []): SpoilerRun[] {
	const groups: SpoilerRun[] = []
	for (const node of content) {
		const spoiler = isSpoiler(node)
		const href = linkOf(node)
		let group = groups.at(-1)
		if (group?.spoiler !== spoiler) {
			group = { spoiler, runs: [] }
			groups.push(group)
		}
		const run = group.runs.at(-1)
		if (run && run.href === href) run.nodes.push(node)
		else group.runs.push({ href, nodes: [node] })
	}
	return groups
}

/** Plain text of a group, e.g. to size a hidden spoiler's filler. */
export function textOf(group: SpoilerRun): string {
	return group.runs
		.flatMap((run) => run.nodes)
		.map((node) => (node.type === 'text' ? node.text : '\n'))
		.join('')
}
