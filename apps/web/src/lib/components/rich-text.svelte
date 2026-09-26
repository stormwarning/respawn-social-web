<script lang="ts">
import type { ClassValue } from 'svelte/elements'
import { parse } from '$lib/richtext/facets'
import { groupInline, type LinkRun } from '$lib/richtext/render'
import type { RichBlock, RichInline, RichTextValue } from '$lib/richtext/types'
import RichTextSpoiler from './rich-text-spoiler.svelte'

interface Props {
	value: RichTextValue
	class?: ClassValue
}

let { value, class: className }: Props = $props()

let doc = $derived(parse(value))

function has(node: RichInline, type: 'bold' | 'italic') {
	return node.type === 'text' && !!node.marks?.some((mark) => mark.type === type)
}
</script>

<!--
	Inline snippets are written without whitespace between nodes: any
	whitespace here would end up in the rendered text.
-->

{#snippet leaf(node: RichInline)}
	{#if node.type === 'hardBreak'}
		<br />
	{:else if has(node, 'bold') && has(node, 'italic')}
		<strong><em>{node.text}</em></strong>
	{:else if has(node, 'bold')}
		<strong>{node.text}</strong>
	{:else if has(node, 'italic')}
		<em>{node.text}</em>
	{:else}
		{node.text}
	{/if}
{/snippet}

{#snippet runs(list: LinkRun[])}
	{#each list as run}{#if run.href}<a
				href={run.href}
				rel="nofollow ugc noopener noreferrer"
				target="_blank"
				>{#each run.nodes as node}{@render leaf(node)}{/each}</a
			>{:else}{#each run.nodes as node}{@render leaf(node)}{/each}{/if}{/each}
{/snippet}

{#snippet inline(content: RichInline[] | undefined)}
	{#each groupInline(content) as group}{#if group.spoiler}<RichTextSpoiler {group}
				>{@render runs(group.runs)}</RichTextSpoiler
			>{:else}{@render runs(group.runs)}{/if}{/each}
{/snippet}

{#snippet block(node: RichBlock)}
	{#if node.type === 'paragraph'}
		<p>{@render inline(node.content)}</p>
	{:else if node.type === 'bulletList'}
		<ul>
			{#each node.content as item}<li>{@render inline(item.content[0]?.content)}</li>{/each}
		</ul>
	{:else if node.type === 'orderedList'}
		<ol>
			{#each node.content as item}<li>{@render inline(item.content[0]?.content)}</li>{/each}
		</ol>
	{:else}
		<blockquote>
			{#each node.content as child}{@render block(child)}{/each}
		</blockquote>
	{/if}
{/snippet}

<div class={['rich-text', className]}>
	{#each doc.content as node}{@render block(node)}{/each}
</div>
