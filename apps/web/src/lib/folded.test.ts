import { describe, expect, it } from 'vitest'
import { baseName, groupFolded, nameFoldedGroup } from './folded'
import type { FoldedMember } from '$lib/types/game'

const member = (partial: Partial<FoldedMember> = {}): FoldedMember => ({
	id: 1,
	foldType: 'version',
	label: 'Edition',
	displayName: 'Collector’s Edition',
	shortName: 'Collector’s Edition',
	parentName: null,
	coverImageId: null,
	coverUrl: null,
	releaseYear: null,
	...partial,
})

describe('baseName', () => {
	it('leaves a name with no parent alone', () => {
		expect(baseName({ shortName: 'Blood and Wine', parentName: null })).toBe('Blood and Wine')
	})

	it('leaves a name that does not repeat its parent alone', () => {
		expect(baseName({ shortName: 'Collector’s Edition', parentName: 'Cataclysm' })).toBe(
			'Collector’s Edition',
		)
	})

	it('strips a parent name IGDB worked into the title', () => {
		// The odd one out among WoW's editions, spelled with its own abbreviation.
		expect(
			baseName({
				shortName: 'WoW: Battle for Azeroth – Collector’s Edition',
				parentName: 'Battle for Azeroth',
			}),
		).toBe('Collector’s Edition')
	})

	it('keeps the full name when stripping would leave nothing', () => {
		expect(baseName({ shortName: 'Legion', parentName: 'Legion' })).toBe('Legion')
	})
})

describe('nameFoldedGroup', () => {
	it('leaves distinct names bare', () => {
		// Nothing collides, so nothing needs a qualifier — this is the case that
		// turned "10th Anniversary Edition" into "Complete Edition: 10th
		// Anniversary Edition" when qualification was unconditional.
		expect(
			nameFoldedGroup([
				{ shortName: 'Collector’s Edition', parentName: null },
				{ shortName: 'Game of the Year Edition', parentName: null },
				{ shortName: '10th Anniversary Edition', parentName: 'Complete Edition' },
			]),
		).toEqual(['Collector’s Edition', 'Game of the Year Edition', '10th Anniversary Edition'])
	})

	it('qualifies names that collide, and only those', () => {
		expect(
			nameFoldedGroup([
				{ shortName: 'Collector’s Edition', parentName: null },
				{ shortName: 'Collector’s Edition', parentName: 'Cataclysm' },
				{ shortName: 'Collector’s Edition', parentName: 'Shadowlands' },
				{ shortName: '15th Anniversary Collector’s Edition', parentName: null },
			]),
		).toEqual([
			// The base game's stays bare; it is the one without an expansion.
			'Collector’s Edition',
			'Cataclysm: Collector’s Edition',
			'Shadowlands: Collector’s Edition',
			'15th Anniversary Collector’s Edition',
		])
	})

	it('spells a name IGDB pre-qualified the same as the rest', () => {
		// Reduced to its base first, so it collides and is rebuilt in the same
		// shape rather than sitting in the list spelled differently.
		expect(
			nameFoldedGroup([
				{ shortName: 'Collector’s Edition', parentName: 'Legion' },
				{
					shortName: 'WoW: Battle for Azeroth – Collector’s Edition',
					parentName: 'Battle for Azeroth',
				},
			]),
		).toEqual(['Legion: Collector’s Edition', 'Battle for Azeroth: Collector’s Edition'])
	})

	it('collapses genuine duplicates', () => {
		// Same name, same parent: one product recorded twice, not two products.
		expect(
			nameFoldedGroup([
				{ shortName: 'Deluxe Edition', parentName: null },
				{ shortName: 'Deluxe Edition', parentName: null },
			]),
		).toEqual(['Deluxe Edition'])
	})

	it('keeps a colliding name once when it has no parent to qualify with', () => {
		expect(
			nameFoldedGroup([
				{ shortName: 'Collector’s Edition', parentName: null },
				{ shortName: 'Collector’s Edition', parentName: null },
				{ shortName: 'Collector’s Edition', parentName: 'Legion' },
			]),
		).toEqual(['Collector’s Edition', 'Legion: Collector’s Edition'])
	})
})

describe('groupFolded', () => {
	it('orders groups and heads them by what they are', () => {
		const groups = groupFolded(
			[
				member({ id: 1, foldType: 'version', shortName: 'Deluxe Edition' }),
				member({ id: 2, foldType: 'expansion', shortName: 'Blood and Wine' }),
				member({ id: 3, foldType: 'dlc', shortName: 'Hearts of Stone' }),
				member({ id: 4, foldType: 'remaster', shortName: 'Remastered' }),
			],
			'A Game',
		)
		expect(groups.map((g) => g.heading)).toEqual(['Expansions', 'DLC', 'Remasters', 'Editions'])
	})

	it('shows editions and override members under one heading', () => {
		const groups = groupFolded(
			[
				member({ id: 1, foldType: 'version', shortName: 'Deluxe Edition' }),
				member({ id: 2, foldType: 'override', shortName: 'Hand-folded Edition' }),
			],
			'A Game',
		)
		expect(groups).toEqual([
			{ heading: 'Editions', names: ['Deluxe Edition', 'Hand-folded Edition'] },
		])
	})

	it('leaves ports out', () => {
		// They merge platforms and say nothing a reader wants: "Halo (Xbox 360)".
		const groups = groupFolded(
			[member({ id: 1, foldType: 'port', shortName: 'A Game (Switch)' })],
			'A Game',
		)
		expect(groups).toEqual([])
	})

	it('drops a member whose name is just the title', () => {
		// 4,430 of these exist — version children IGDB filed with no version
		// title. "Includes: Grand Theft Auto V" on that page says nothing.
		const groups = groupFolded(
			[
				member({ id: 1, foldType: 'version', shortName: 'Grand Theft Auto V' }),
				member({ id: 2, foldType: 'version', shortName: 'Special Edition' }),
			],
			'Grand Theft Auto V',
		)
		expect(groups).toEqual([{ heading: 'Editions', names: ['Special Edition'] }])
	})

	it('returns nothing when a title folded nothing in', () => {
		expect(groupFolded([], 'A Game')).toEqual([])
	})
})
