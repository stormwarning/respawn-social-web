import { fail, redirect } from '@sveltejs/kit'
import { resolvePdsEndpoint } from '$lib/atproto/identity'
import type { Did } from '@atcute/lexicons/syntax'
import {
	ACCEPTED_AVATAR_TYPES,
	MAX_AVATAR_BYTES,
	avatarUrlForBlob,
	blobUrl,
	loadRespawnProfile,
	putRespawnProfile,
	type RespawnProfileRecord,
} from '$lib/atproto/profile'
import { loadGameRecord } from '$lib/atproto/game'
import { DEFAULT_PRONOUNS, isPronouns } from '$lib/atproto/pronouns'
import { uploadCover } from '$lib/server/cover'
import { parseFaves, type ParsedFave } from './faves'
import { cachedBskyProfile, cachedRespawnProfile, forgetProfile } from '$lib/server/profile-cache'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.agent) redirect(303, '/login')
	const { agent, user } = locals

	// The same three lookups the layout header does, so in a single request these
	// are cache hits rather than a second round of fetches. The Bluesky profile is
	// always needed for the handle + prefill defaults.
	const [bsky, respawn, pds] = await Promise.all([
		cachedBskyProfile(agent, user.did),
		cachedRespawnProfile(agent, user.did),
		resolvePdsEndpoint(user.did as Did),
	])

	let avatarUrl = bsky.avatarUrl
	if (respawn?.avatar) {
		avatarUrl = avatarUrlForBlob(pds, user.did, respawn.avatar) ?? avatarUrl
	}

	return {
		handle: bsky.handle,
		displayName: respawn?.displayName ?? bsky.displayName,
		description: respawn?.description ?? bsky.description,
		avatarUrl,
		// The lexicon vocabulary is open, so anything we don't offer in the select
		// (including values written before the list existed) falls back to the default.
		pronouns: isPronouns(respawn?.pronouns) ? respawn.pronouns : DEFAULT_PRONOUNS,
		channel: respawn?.channel ?? '',
		bsky: respawn?.bsky ?? user.did,
		adultContent: respawn?.adultContent ?? 'blur',
		faves: (respawn?.faves ?? []).map((fave) => ({
			igdbId: fave.game.igdbId,
			slug: fave.game.slug,
			title: fave.game.title,
			coverUrl: blobUrl(pds, user.did, fave.cover?.image),
		})),
		hasRespawnProfile: respawn !== null,
	}
}

const ADULT_CONTENT_VALUES = ['show', 'blur', 'hide'] as const
type AdultContent = (typeof ADULT_CONTENT_VALUES)[number]

type ProfileFave = NonNullable<RespawnProfileRecord['faves']>[number]

/**
 * Turn the posted favourites into records, attaching a cover blob to each. A
 * cover already in the repo — on the previous version of this fave, or on the
 * game record if the user has the game in their collection — is reused, so the
 * upload only runs the first time a game is favourited. The cover is optional
 * in the lexicon, so an upload failure loses the image, not the save.
 */
async function resolveFaves(
	agent: NonNullable<App.Locals['agent']>,
	did: string,
	faves: ParsedFave[],
	existing: RespawnProfileRecord,
): Promise<ProfileFave[]> {
	const priorCovers = new Map((existing.faves ?? []).map((f) => [f.game.igdbId, f.cover]))

	return Promise.all(
		faves.map(async ({ igdbId, slug, title, rawCoverUrl }): Promise<ProfileFave> => {
			let cover = priorCovers.get(igdbId)
			if (!cover) cover = (await loadGameRecord(agent, did, igdbId))?.cover
			if (!cover && rawCoverUrl) {
				try {
					cover = await uploadCover(agent, rawCoverUrl)
				} catch (err) {
					console.error('[profile] fave cover upload failed', err)
				}
			}
			return { game: { igdbId, slug, title }, cover }
		}),
	)
}

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

		const faves = parseFaves(String(form.get('faves') ?? ''))
		if ('error' in faves) return fail(400, faves)

		if (channel && !/^https?:\/\//.test(channel)) {
			return fail(400, { error: 'Channel must be an http(s) URL.' })
		}
		if (bsky && !bsky.startsWith('did:')) {
			return fail(400, { error: 'Bluesky account must be a DID (did:plc:… or did:web:…).' })
		}
		if (adultContent && !ADULT_CONTENT_VALUES.includes(adultContent as AdultContent)) {
			return fail(400, { error: 'Invalid adult content setting.' })
		}
		if (pronouns && !isPronouns(pronouns)) {
			return fail(400, { error: 'Invalid pronouns setting.' })
		}

		// Start from the existing record so unchanged fields (e.g. avatar) survive.
		const existing = (await loadRespawnProfile(agent, user.did)) ?? {}
		const resolvedFaves = await resolveFaves(agent, user.did, faves, existing)
		const record: RespawnProfileRecord = {
			...existing,
			faves: resolvedFaves.length ? resolvedFaves : undefined,
			displayName: displayName || undefined,
			description: description || undefined,
			pronouns: isPronouns(pronouns) ? pronouns : DEFAULT_PRONOUNS,
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
		// The header and this page read through a cache; drop it so the saved
		// display name and avatar show up on the very next render.
		forgetProfile(user.did)

		return { success: true }
	},
}
