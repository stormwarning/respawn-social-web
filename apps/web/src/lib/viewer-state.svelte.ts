import { browser } from '$app/environment'
import { SvelteSet } from 'svelte/reactivity'
import type { ViewerGameState, ViewerState } from '$lib/server/viewer-state'

export type { ViewerGameState }

const UNTOUCHED: ViewerGameState = { played: null, playing: false, liked: false, rating: 0 }

/**
 * The signed-in viewer's own game state, hydrated once per session from
 * `/api/viewer/state` and kept current by writing through on every successful
 * action.
 *
 * Play-state and backlog buttons belong on list pages too, where the server
 * would have to answer for dozens of games at once. Reading them from here keeps
 * those payloads viewer-independent — and therefore cacheable — while the
 * lookups themselves cost nothing.
 */
class ViewerStateStore {
	games = $state<Record<string, ViewerGameState>>({})
	backlog = new SvelteSet<number>()
	status = $state<'idle' | 'loading' | 'ready' | 'error'>('idle')

	/** Shared with concurrent callers so a layout effect and a button make one request. */
	#inFlight: Promise<void> | null = null
	/** Bumped by `reset`, so a response that outlives its session is discarded. */
	#session = 0

	load(): Promise<void> {
		if (!browser || this.status === 'ready') return Promise.resolve()
		if (this.#inFlight) return this.#inFlight

		const pending: Promise<void> = this.#hydrate().finally(() => {
			// A sign-out mid-flight may already have started a newer request.
			if (this.#inFlight === pending) this.#inFlight = null
		})
		this.#inFlight = pending
		return pending
	}

	async #hydrate(): Promise<void> {
		const session = this.#session
		this.status = 'loading'
		try {
			const res = await fetch('/api/viewer/state')
			if (!res.ok) throw new Error(`HTTP ${res.status}`)
			const state = (await res.json()) as ViewerState
			if (session !== this.#session) return
			this.games = state.games
			for (const igdbId of state.backlog) this.backlog.add(igdbId)
			this.status = 'ready'
		} catch (err) {
			// Buttons fall back to their untouched look, which is wrong but legible.
			// Nothing here is worth failing a page render over.
			console.error('[viewer-state] load failed', err)
			if (session === this.#session) this.status = 'error'
		}
	}

	/** Called on sign-out: the next user must not inherit this one's state. */
	reset(): void {
		this.#session += 1
		this.#inFlight = null
		this.games = {}
		this.backlog.clear()
		this.status = 'idle'
	}

	game(igdbId: number): ViewerGameState {
		return this.games[String(igdbId)] ?? UNTOUCHED
	}

	inBacklog(igdbId: number): boolean {
		return this.backlog.has(igdbId)
	}

	setGame(igdbId: number, patch: Partial<ViewerGameState>): void {
		const key = String(igdbId)
		this.games = { ...this.games, [key]: { ...(this.games[key] ?? UNTOUCHED), ...patch } }
	}

	setBacklog(igdbId: number, inBacklog: boolean): void {
		if (inBacklog) this.backlog.add(igdbId)
		else this.backlog.delete(igdbId)
	}
}

export const viewerState = new ViewerStateStore()
