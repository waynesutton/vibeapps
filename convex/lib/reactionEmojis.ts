/**
 * The reaction emojis allowed on direct messages.
 *
 * This module deliberately imports nothing — not even `convex/values` — so the
 * frontend can import the list to render a picker without pulling server code
 * or validator machinery into the browser bundle. `convex/dmReactions.ts`
 * builds the matching validator and is type-checked against `ReactionEmoji`,
 * so the two cannot drift.
 */
export const ALLOWED_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "👏"] as const;

export type ReactionEmoji = (typeof ALLOWED_EMOJIS)[number];
