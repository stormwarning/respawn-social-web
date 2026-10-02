import { describe, expect, it } from 'vitest'
import { baseName, groupFolded, logOptions, nameFoldedGroup } from './folded'
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
	localizedName: null,
	localizedLang: null,
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

	it('lists the original release first', () => {
		// Super Mario Bros. 2 crowned over the game it was ported from.
		const groups = groupFolded(
			[
				member({ id: 222098, foldType: 'remaster', shortName: 'Super Mario All-Stars' }),
				member({
					id: 41233,
					foldType: 'original',
					shortName: 'Yume Koujou: Doki-doki Panic',
					localizedName: '夢工場ドキドキパニック',
					localizedLang: 'ja-JP',
				}),
			],
			'Super Mario Bros. 2',
		)
		expect(groups).toEqual([
			{ kind: 'original', heading: 'Original release', names: ['Yume Koujou: Doki-doki Panic'] },
			{ kind: 'remaster', heading: 'Remasters', names: ['Super Mario All-Stars'] },
		])
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
			{ kind: 'edition', heading: 'Editions', names: ['Deluxe Edition', 'Hand-folded Edition'] },
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
		expect(groups).toEqual([{ kind: 'edition', heading: 'Editions', names: ['Special Edition'] }])
	})

	it('drops editions of expansions, which are listed already', () => {
		// World of Warcraft: each expansion's Collector's Edition folds in with it.
		const groups = groupFolded(
			[
				member({ id: 1, shortName: 'Collector’s Edition' }),
				member({ id: 2, foldType: 'expansion', shortName: 'Cataclysm' }),
				member({ id: 3, shortName: 'Collector’s Edition', parentName: 'Cataclysm' }),
				member({ id: 4, foldType: 'expansion', shortName: 'Battle for Azeroth' }),
				member({
					id: 5,
					shortName: 'WoW: Battle for Azeroth – Collector’s Edition',
					parentName: 'Battle for Azeroth',
				}),
				member({ id: 6, shortName: '15th Anniversary Collector’s Edition' }),
				member({
					id: 7,
					foldType: 'expansion',
					shortName: 'Burning Crusade Classic',
					parentName: 'Classic',
				}),
				member({ id: 8, shortName: 'Anniversary Edition', parentName: 'Burning Crusade Classic' }),
			],
			'World of Warcraft',
		)
		expect(groups).toEqual([
			{
				kind: 'expansion',
				heading: 'Expansions',
				names: ['Cataclysm', 'Battle for Azeroth', 'Burning Crusade Classic'],
			},
			{
				kind: 'edition',
				heading: 'Editions',
				names: ['Collector’s Edition', '15th Anniversary Collector’s Edition'],
			},
		])
	})

	it('keeps an edition of another edition', () => {
		const groups = groupFolded(
			[
				member({ id: 1, foldType: 'expansion', shortName: 'Blood and Wine' }),
				member({ id: 2, shortName: 'Complete Edition' }),
				member({ id: 3, shortName: '10th Anniversary Edition', parentName: 'Complete Edition' }),
			],
			'The Witcher 3: Wild Hunt',
		)
		expect(groups.at(-1)).toEqual({
			kind: 'edition',
			heading: 'Editions',
			names: ['Complete Edition', '10th Anniversary Edition'],
		})
	})

	it('returns nothing when a title folded nothing in', () => {
		expect(groupFolded([], 'A Game')).toEqual([])
	})
})

describe('logOptions', () => {
	it('offers editions to pick one of and add-ons to pick any of, under the page’s headings', () => {
		const groups = groupFolded(
			[
				member({ id: 1, foldType: 'original', shortName: 'The Original' }),
				member({ id: 2, foldType: 'expansion', shortName: 'Blood and Wine' }),
				member({ id: 3, foldType: 'dlc', shortName: 'Fool’s Gold' }),
				member({ id: 4, foldType: 'remaster', shortName: 'Remastered' }),
				member({ id: 5, shortName: 'Complete Edition' }),
			],
			'A Game',
		)
		const { editions, addOns } = logOptions(groups)
		expect(editions.map((g) => g.heading)).toEqual(['Remasters', 'Editions'])
		expect(addOns.map((g) => g.heading)).toEqual(['Expansions', 'DLC'])
	})
})
