import { fail, redirect } from '@sveltejs/kit'
import { resolvePdsEndpoint } from '$lib/atproto/identity'
import type { Did } from '@atcute/lexicons/syntax'
import {
	avatarUrlForBlob,
	loadBskyProfile,
	loadRespawnProfile,
	putRespawnProfile,
	type RespawnProfileRecord,
} from '$lib/atproto/profile'
import type { Actions, PageServerLoad } from './$types'

const MAX_AVATAR_BYTES = 1_000_000
const ACCEPTED_AVATAR_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.agent) redirect(303, '/login')
	const { agent, user } = locals

	// Always fetch the Bluesky profile for the handle + prefill defaults.
	const bsky = await loadBskyProfile(agent, user.did)
	const respawn = await loadRespawnProfile(agent, user.did)

	let avatarUrl = bsky.avatarUrl
	if (respawn?.avatar) {
		const pds = await resolvePdsEndpoint(user.did as Did)
		avatarUrl = avatarUrlForBlob(pds, user.did, respawn.avatar) ?? avatarUrl
	}

	return {
		handle: bsky.handle,
		displayName: respawn?.displayName ?? bsky.displayName,
		description: respawn?.description ?? bsky.description,
		avatarUrl,
		pronouns: respawn?.pronouns ?? '',
		channel: respawn?.channel ?? '',
		bsky: respawn?.bsky ?? user.did,
		adultContent: respawn?.adultContent ?? 'blur',
		hasRespawnProfile: respawn !== null,
	}
}

const ADULT_CONTENT_VALUES = ['show', 'blur', 'hide'] as const
type AdultContent = (typeof ADULT_CONTENT_VALUES)[number]

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user || !locals.agent) redirect(303, '/login')
		const { agent, user } = locals

		const form = await request.formData()
		const displayName = String(form.get('displayName') ?? '').trim()
		const description = String(form.get('description') ?? '').trim()
		const pronouns = String(form.get('pronouns') ?? '').trim()
		const channel = String(form.get('channel') ?? '').trim()
		const bsky = String(form.get('bsky') ?? '').trim()
		const adultContent = String(form.get('adultContent') ?? '')
		const avatarFile = form.get('avatar')

		if (channel && !/^https?:\/\//.test(channel)) {
			return fail(400, { error: 'Channel must be an http(s) URL.' })
		}
		if (bsky && !bsky.startsWith('did:')) {
			return fail(400, { error: 'Bluesky account must be a DID (did:plc:… or did:web:…).' })
		}
		if (adultContent && !ADULT_CONTENT_VALUES.includes(adultContent as AdultContent)) {
			return fail(400, { error: 'Invalid adult content setting.' })
		}

		// Start from the existing record so unchanged fields (e.g. avatar, faves) survive.
		const existing = (await loadRespawnProfile(agent, user.did)) ?? {}
		const record: RespawnProfileRecord = {
			...existing,
			displayName: displayName || undefined,
			description: description || undefined,
			pronouns: pronouns || undefined,
			channel: channel || undefined,
			bsky: bsky || undefined,
			adultContent: (adultContent as AdultContent) || undefined,
			createdAt: existing.createdAt ?? new Date().toISOString(),
		}

		if (avatarFile instanceof File && avatarFile.size > 0) {
			if (!ACCEPTED_AVATAR_TYPES.has(avatarFile.type)) {
				return fail(400, { error: 'Avatar must be a PNG, JPEG, or WebP image.' })
			}
			if (avatarFile.size > MAX_AVATAR_BYTES) {
				return fail(400, { error: 'Avatar must be smaller than 1 MB.' })
			}
			try {
				const bytes = new Uint8Array(await avatarFile.arrayBuffer())
				const res = await agent.com.atproto.repo.uploadBlob(bytes, {
					encoding: avatarFile.type,
				})
				record.avatar = res.data.blob
			} catch (err) {
				console.error('[profile] avatar upload failed', err)
				return fail(500, { error: 'Avatar upload failed. Try again.' })
			}
		}

		try {
			await putRespawnProfile(agent, user.did, record)
		} catch (err) {
			console.error('[profile] putRecord failed', err)
			return fail(500, { error: 'Could not save your profile. Try again.' })
		}

		return { success: true }
	},
}
