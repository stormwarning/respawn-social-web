import { describe, expect, it } from 'vitest'
import {
	activitySentence,
	activityVerb,
	emptyLogForm,
	fromLogRecord,
	toLogRecord,
	type LogFormValue,
} from './log-form'

const game = { igdbId: 11737, slug: 'outer-wilds', title: 'Outer Wilds', year: 2019 }
const createdAt = '2026-09-27T12:00:00.000Z'

describe('emptyLogForm', () => {
	it('starts a playthrough when there is no state', () => {
		expect(emptyLogForm(undefined, '2026-09-27').startedPlaying).toBe(true)
		expect(emptyLogForm({ playing: false, played: null }).startedPlaying).toBe(true)
	})

	it('starts from the game’s rating, like and last platform', () => {
		const value = emptyLogForm({
			playing: false,
			played: 'completed',
			rating: 8,
			liked: true,
			platform: 'PC',
		})
		expect(value).toMatchObject({ rating: 8, liked: true, platform: 'PC' })
		expect(emptyLogForm({ playing: false, played: null, platform: null }).platform).toBe('')
	})

	it('continues when already playing or finished', () => {
		expect(emptyLogForm({ playing: true, played: null }).startedPlaying).toBe(false)
		expect(emptyLogForm({ playing: false, played: 'completed' }).startedPlaying).toBe(false)
	})
})

describe('toLogRecord', () => {
	it('drops everything left unset', () => {
		const value = { ...emptyLogForm(undefined, ''), startedPlaying: false }
		expect(toLogRecord(value, game, createdAt)).toEqual({
			log: {
				game: { igdbId: 11737, slug: 'outer-wilds', title: 'Outer Wilds' },
				createdAt,
			},
		})
	})

	it('trims text fields and drops blank DLC', () => {
		const value: LogFormValue = {
			...emptyLogForm(undefined, '2026-09-20'),
			platform: '  PC ',
			edition: ' ',
			dlc: ['Echoes of the Eye', ' '],
		}
		const { log } = toLogRecord(value, game, createdAt)
		expect(log.platform).toBe('PC')
		expect(log.edition).toBeUndefined()
		expect(log.dlc).toEqual(['Echoes of the Eye'])
		expect(log.datePlayed).toBe('2026-09-20T00:00:00.000Z')
		expect(log.startedPlaying).toBe(true)
	})

	it('drops a spoiler flag without review text', () => {
		const value: LogFormValue = { ...emptyLogForm(), containsSpoilers: true }
		expect(toLogRecord(value, game, createdAt).log.review).toBeUndefined()
	})

	it('writes a replygate only when comments are limited', () => {
		expect(toLogRecord(emptyLogForm(), game).replygate).toBeUndefined()
		expect(toLogRecord({ ...emptyLogForm(), allow: 'nobody' }, game).replygate).toEqual({
			allow: [],
		})
		expect(
			toLogRecord({ ...emptyLogForm(), allow: ['followers', 'mention'] }, game).replygate,
		).toEqual({ allow: ['followers', 'mention'] })
	})
})

describe('fromLogRecord', () => {
	it('round-trips a full log', () => {
		const value: LogFormValue = {
			datePlayed: '2026-09-20',
			platform: 'PC',
			edition: 'Archaeologist Edition',
			dlc: ['Echoes of the Eye'],
			startedPlaying: false,
			finishedPlaying: 'completed',
			rating: 9,
			liked: true,
			review: { text: 'So good.' },
			containsSpoilers: true,
			allow: ['following', 'mention'],
		}
		const { log, replygate } = toLogRecord(value, game, createdAt)
		expect(fromLogRecord(log, replygate)).toEqual(value)
	})

	it('reads a missing replygate or allow list as anyone', () => {
		const { log } = toLogRecord(emptyLogForm(), game, createdAt)
		expect(fromLogRecord(log).allow).toBe('anyone')
		expect(fromLogRecord(log, {}).allow).toBe('anyone')
	})

	it('reads an empty allow list as nobody', () => {
		const { log } = toLogRecord(emptyLogForm(), game, createdAt)
		expect(fromLogRecord(log, { allow: [] }).allow).toBe('nobody')
	})
})

describe('activityVerb', () => {
	it('describes the session from the log alone', () => {
		expect(activityVerb({ startedPlaying: true })).toBe('started playing')
		expect(activityVerb({ finishedPlaying: 'completed' })).toBe('completed')
		expect(activityVerb({ finishedPlaying: 'played' })).toBe('finished playing')
		expect(activityVerb({ finishedPlaying: 'shelved' })).toBe('shelved')
		expect(activityVerb({ startedPlaying: true, finishedPlaying: 'played' })).toBe('played through')
		expect(activityVerb({ startedPlaying: true, finishedPlaying: 'abandoned' })).toBe(
			'started and abandoned',
		)
	})

	it('falls back to the review, then the rating', () => {
		expect(activityVerb({ review: { text: 'Great.' }, rating: 8 })).toBe('reviewed')
		expect(activityVerb({ rating: 8 })).toBe('rated')
		expect(activityVerb({})).toBe('logged')
	})
})

describe('activitySentence', () => {
	it('puts the actor and game around the verb', () => {
		const { log } = toLogRecord(emptyLogForm(), game, createdAt)
		expect(activitySentence(log, 'alice')).toBe('alice started playing Outer Wilds')
	})
})
