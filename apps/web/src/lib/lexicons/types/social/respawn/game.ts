import type {} from '@atcute/lexicons'
import * as v from '@atcute/lexicons/validations'
import type {} from '@atcute/lexicons/ambient'

const _colorsSchema = /*#__PURE__*/ v.object({
	$type: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal('social.respawn.game#colors')),
	/**
	 * Dominant cover color as a hex string, e.g. #1a2b3c.
	 */
	dominant: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.string()),
})
const _coverSchema = /*#__PURE__*/ v.object({
	$type: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.literal('social.respawn.game#cover')),
	get colors() {
		return /*#__PURE__*/ v.optional(colorsSchema)
	},
	/**
	 * @accept image/png, image/jpeg, image/webp
	 * @maxSize 1000000
	 */
	image: /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.blob(), [
		/*#__PURE__*/ v.blobSize(1000000),
		/*#__PURE__*/ v.blobAccept(['image/png', 'image/jpeg', 'image/webp']),
	]),
})
const _mainSchema = /*#__PURE__*/ v.record(
	/*#__PURE__*/ v.string(),
	/*#__PURE__*/ v.object({
		$type: /*#__PURE__*/ v.literal('social.respawn.game'),
		get cover() {
			return /*#__PURE__*/ v.optional(coverSchema)
		},
		createdAt: /*#__PURE__*/ v.datetimeString(),
		liked: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.boolean()),
		/**
		 * Play state. Absent means not played.
		 */
		played: /*#__PURE__*/ v.optional(
			/*#__PURE__*/ v.string<
				'abandoned' | 'completed' | 'played' | 'retired' | 'shelved' | (string & {})
			>(),
		),
		playing: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.boolean()),
		/**
		 * Actor's rating, 1-10.
		 * @minimum 1
		 * @maximum 10
		 */
		rating: /*#__PURE__*/ v.optional(
			/*#__PURE__*/ v.constrain(/*#__PURE__*/ v.integer(), [/*#__PURE__*/ v.integerRange(1, 10)]),
		),
	}),
)

type colors$schematype = typeof _colorsSchema
type cover$schematype = typeof _coverSchema
type main$schematype = typeof _mainSchema

export interface colorsSchema extends colors$schematype {}
export interface coverSchema extends cover$schematype {}
export interface mainSchema extends main$schematype {}

export const colorsSchema = _colorsSchema as colorsSchema
export const coverSchema = _coverSchema as coverSchema
export const mainSchema = _mainSchema as mainSchema

export interface Colors extends v.InferInput<typeof colorsSchema> {}
export interface Cover extends v.InferInput<typeof coverSchema> {}
export interface Main extends v.InferInput<typeof mainSchema> {}

declare module '@atcute/lexicons/ambient' {
	interface Records {
		'social.respawn.game': mainSchema
	}
}
