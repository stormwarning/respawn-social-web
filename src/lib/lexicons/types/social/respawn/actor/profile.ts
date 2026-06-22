import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";

const _mainSchema = /*#__PURE__*/ v.record(
  /*#__PURE__*/ v.literal("self"),
  /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.literal("social.respawn.actor.profile"),
    /**
     * Small image to be displayed next to the actor's display name.
     * @accept image/png, image/jpeg, image/webp
     * @maxSize 1000000
     */
    avatar: /*#__PURE__*/ v.optional(
      /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.blob(), [
        /*#__PURE__*/ v.blobSize(1000000),
        /*#__PURE__*/ v.blobAccept(["image/png", "image/jpeg", "image/webp"]),
      ]),
    ),
    createdAt: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.datetimeString()),
    /**
     * Free-form profile description text.
     * @maxLength 2560
     * @maxGraphemes 256
     */
    description: /*#__PURE__*/ v.optional(
      /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
        /*#__PURE__*/ v.stringLength(0, 2560),
        /*#__PURE__*/ v.stringGraphemes(0, 256),
      ]),
    ),
    /**
     * @maxLength 640
     * @maxGraphemes 64
     */
    displayName: /*#__PURE__*/ v.optional(
      /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
        /*#__PURE__*/ v.stringLength(0, 640),
        /*#__PURE__*/ v.stringGraphemes(0, 64),
      ]),
    ),
  }),
);

type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}

export const mainSchema = _mainSchema as mainSchema;

export interface Main extends v.InferInput<typeof mainSchema> {}

declare module "@atcute/lexicons/ambient" {
  interface Records {
    "social.respawn.actor.profile": mainSchema;
  }
}
