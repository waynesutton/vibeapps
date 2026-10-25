// Shared abuse limits for public entry points, built on the rate limiter
// component. Keys use the signed in user id when there is one, else the
// caller IP from request metadata. Global ceilings cap total volume so a
// rotating IP pool still hits a wall.

import { ConvexError } from "convex/values";
import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";
import type { ActionCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export const securityLimiter = new RateLimiter(components.rateLimiter, {
  // Anonymous /resend and /ychack submissions
  anonSubmit: { kind: "fixed window", rate: 10, period: HOUR },
  anonSubmitGlobal: { kind: "fixed window", rate: 300, period: HOUR, shards: 4 },
  // Upload URLs (admin pages mint many while editing, so the cap is generous)
  uploadUrl: { kind: "token bucket", rate: 60, period: HOUR, capacity: 60 },
  uploadUrlGlobal: {
    kind: "token bucket",
    rate: 3000,
    period: HOUR,
    capacity: 3000,
    shards: 8,
  },
  // Public custom form posts
  formSubmit: { kind: "fixed window", rate: 20, period: HOUR },
  formSubmitGlobal: { kind: "fixed window", rate: 600, period: HOUR, shards: 4 },
  // Group password guesses, keyed per group plus caller
  passwordAttempt: {
    kind: "token bucket",
    rate: 10,
    period: 15 * MINUTE,
    capacity: 10,
  },
  passwordAttemptGroup: {
    kind: "token bucket",
    rate: 200,
    period: 15 * MINUTE,
    capacity: 200,
    shards: 4,
  },
  // Signed in social actions
  comment: { kind: "token bucket", rate: 20, period: 10 * MINUTE, capacity: 20 },
  vote: { kind: "token bucket", rate: 60, period: MINUTE, capacity: 60 },
  dmReport: { kind: "fixed window", rate: 10, period: HOUR },
  // Organizer triggered paid fetches, per judging group
  socialProofRefresh: { kind: "fixed window", rate: 2, period: 10 * MINUTE },
});

export type SecurityLimitName =
  | "anonSubmit"
  | "anonSubmitGlobal"
  | "uploadUrl"
  | "uploadUrlGlobal"
  | "formSubmit"
  | "formSubmitGlobal"
  | "passwordAttempt"
  | "passwordAttemptGroup"
  | "comment"
  | "vote"
  | "dmReport"
  | "socialProofRefresh";

// Caller key: user id when signed in, else the request IP
export async function callerKey(
  ctx: MutationCtx | ActionCtx,
  userId?: Id<"users"> | null,
): Promise<string> {
  if (userId) return `u:${userId}`;
  const { ip } = await ctx.meta.getRequestMetadata();
  return `ip:${ip ?? "unknown"}`;
}

// True when one more unit would be allowed. Consumes nothing.
export async function canUseLimit(
  ctx: MutationCtx | ActionCtx,
  name: SecurityLimitName,
  key?: string,
): Promise<boolean> {
  const status = await securityLimiter.check(ctx, name, key ? { key } : {});
  return status.ok;
}

// Consumes one unit. Returns false when the caller is over the limit.
export async function tryLimit(
  ctx: MutationCtx | ActionCtx,
  name: SecurityLimitName,
  key?: string,
): Promise<boolean> {
  const status = await securityLimiter.limit(ctx, name, key ? { key } : {});
  return status.ok;
}

// Consumes one unit or throws a friendly error with the wait time
export async function enforceLimit(
  ctx: MutationCtx | ActionCtx,
  name: SecurityLimitName,
  key?: string,
): Promise<void> {
  const status = await securityLimiter.limit(ctx, name, key ? { key } : {});
  if (!status.ok) {
    const seconds = Math.max(1, Math.ceil(status.retryAfter / 1000));
    const wait =
      seconds >= 120 ? `${Math.ceil(seconds / 60)} minutes` : `${seconds} seconds`;
    throw new ConvexError(`Too many requests. Please try again in ${wait}.`);
  }
}
