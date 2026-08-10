import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { hasPermission, requirePermission } from "./adminAccess";

// Reusable email templates managed in the admin Email dashboard Templates
// sub tab. Editing requires emails.send; reading also allows judging.emails
// so judging group organizers can pick a template when composing.

const templateValidator = v.object({
  _id: v.id("emailTemplates"),
  _creationTime: v.number(),
  name: v.string(),
  subject: v.string(),
  body: v.string(),
  signature: v.optional(v.string()),
  createdBy: v.id("users"),
  updatedAt: v.number(),
});

async function getCurrentUser(ctx: MutationCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required");
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
  if (!user) {
    throw new Error("User not found");
  }
  return user;
}

/**
 * All templates, newest updates first, for the Templates sub tab and the
 * judging group compose template picker.
 */
export const listTemplates = query({
  args: {},
  returns: v.array(templateValidator),
  handler: async (ctx) => {
    const canRead =
      (await hasPermission(ctx, "emails.send")) ||
      (await hasPermission(ctx, "judging.emails"));
    if (!canRead) {
      throw new Error("Permission required: emails.send or judging.emails");
    }
    const templates = await ctx.db.query("emailTemplates").collect();
    return templates.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const createTemplate = mutation({
  args: {
    name: v.string(),
    subject: v.string(),
    body: v.string(),
    signature: v.optional(v.string()),
  },
  returns: v.id("emailTemplates"),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "emails.send");
    const user = await getCurrentUser(ctx);
    const name = args.name.trim();
    if (name === "") throw new Error("Template name is required");
    if (args.subject.trim() === "") throw new Error("Subject is required");
    if (args.body.trim() === "") throw new Error("Body is required");

    return await ctx.db.insert("emailTemplates", {
      name,
      subject: args.subject.trim(),
      body: args.body,
      signature:
        args.signature && args.signature.trim() !== ""
          ? args.signature
          : undefined,
      createdBy: user._id,
      updatedAt: Date.now(),
    });
  },
});

export const updateTemplate = mutation({
  args: {
    templateId: v.id("emailTemplates"),
    name: v.string(),
    subject: v.string(),
    body: v.string(),
    signature: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "emails.send");
    const name = args.name.trim();
    if (name === "") throw new Error("Template name is required");
    if (args.subject.trim() === "") throw new Error("Subject is required");
    if (args.body.trim() === "") throw new Error("Body is required");

    await ctx.db.patch(args.templateId, {
      name,
      subject: args.subject.trim(),
      body: args.body,
      signature:
        args.signature && args.signature.trim() !== ""
          ? args.signature
          : undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const deleteTemplate = mutation({
  args: { templateId: v.id("emailTemplates") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "emails.send");
    const existing = await ctx.db.get(args.templateId);
    if (!existing) return null; // idempotent delete
    await ctx.db.delete(args.templateId);
    return null;
  },
});
