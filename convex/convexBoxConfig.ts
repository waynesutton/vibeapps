import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { requireAdminRole } from "./users";

const CONFIG_IDENTIFIER = "global_convex_box_settings";

// Define the shape of the config WITH the resolved logoUrl
interface ConvexBoxConfigData {
  identifier: string;
  isEnabled: boolean;
  displayText: string;
  linkUrl: string;
  textAboveLogo: boolean;
  logoStorageId?: Id<"_storage">; // Keep original ID for updates
  logoUrl?: string | null; // Resolved URL for client
  boxSize?: "standard" | "square"; // Box size option
  _id?: Id<"convexBoxConfig">; // include typical Doc fields if needed by client
  _creationTime?: number;
}

// Default settings for the ConvexBox
const DEFAULT_CONVEX_BOX_CONFIG: ConvexBoxConfigData = {
  identifier: CONFIG_IDENTIFIER,
  isEnabled: true,
  displayText: "Powered by Convex",
  linkUrl: "https://convex.dev",
  textAboveLogo: true,
  logoStorageId: undefined,
  logoUrl: undefined,
  boxSize: "standard",
};

/**
 * Get the ConvexBox configuration.
 * Returns default settings if no configuration is found in the database.
 */
export const get = query({
  args: {},
  handler: async (ctx): Promise<ConvexBoxConfigData> => {
    const configDoc = await ctx.db
      .query("convexBoxConfig")
      .withIndex("by_identifier", (q) => q.eq("identifier", CONFIG_IDENTIFIER))
      .unique();

    if (!configDoc) {
      return DEFAULT_CONVEX_BOX_CONFIG;
    }

    let logoUrl: string | null = null;
    if (configDoc.logoStorageId) {
      logoUrl = await ctx.storage.getUrl(configDoc.logoStorageId);
    }

    const result: ConvexBoxConfigData = {
      _id: configDoc._id,
      _creationTime: configDoc._creationTime,
      identifier: configDoc.identifier,
      isEnabled: configDoc.isEnabled,
      displayText: configDoc.displayText,
      linkUrl: configDoc.linkUrl,
      textAboveLogo: configDoc.textAboveLogo ?? true,
      logoStorageId: configDoc.logoStorageId,
      logoUrl: logoUrl,
      boxSize: configDoc.boxSize ?? "standard",
    };
    return result;
  },
});

/**
 * Update or create the ConvexBox configuration.
 */
export const update = mutation({
  args: {
    isEnabled: v.optional(v.boolean()),
    displayText: v.optional(v.string()),
    linkUrl: v.optional(v.string()),
    textAboveLogo: v.optional(v.boolean()),
    logoStorageId: v.optional(v.union(v.id("_storage"), v.null())), // Input can be null to clear
    boxSize: v.optional(v.union(v.literal("standard"), v.literal("square"))),
  },
  handler: async (ctx, args) => {
    await requireAdminRole(ctx);
    const existingConfig = await ctx.db
      .query("convexBoxConfig")
      .withIndex("by_identifier", (q) => q.eq("identifier", CONFIG_IDENTIFIER))
      .unique();

    // Prepare updates, explicitly handling null to undefined conversion for logoStorageId if needed by schema
    const updates: Partial<Omit<Doc<"convexBoxConfig">, "_id" | "_creationTime" | "identifier">> =
      {};
    if (args.isEnabled !== undefined) updates.isEnabled = args.isEnabled;
    if (args.displayText !== undefined) updates.displayText = args.displayText;
    if (args.linkUrl !== undefined) updates.linkUrl = args.linkUrl;
    if (args.textAboveLogo !== undefined) updates.textAboveLogo = args.textAboveLogo;
    if (args.logoStorageId !== undefined) {
      // Check if the arg was passed
      updates.logoStorageId = args.logoStorageId === null ? undefined : args.logoStorageId;
    }
    if (args.boxSize !== undefined) updates.boxSize = args.boxSize;

    if (existingConfig) {
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existingConfig._id, updates);
      }
    } else {
      // Create with defaults + provided updates
      const newConfigData: Omit<Doc<"convexBoxConfig">, "_id" | "_creationTime"> = {
        identifier: CONFIG_IDENTIFIER,
        isEnabled:
          args.isEnabled !== undefined ? args.isEnabled : DEFAULT_CONVEX_BOX_CONFIG.isEnabled,
        displayText:
          args.displayText !== undefined ? args.displayText : DEFAULT_CONVEX_BOX_CONFIG.displayText,
        linkUrl: args.linkUrl !== undefined ? args.linkUrl : DEFAULT_CONVEX_BOX_CONFIG.linkUrl,
        textAboveLogo:
          args.textAboveLogo !== undefined
            ? args.textAboveLogo
            : DEFAULT_CONVEX_BOX_CONFIG.textAboveLogo,
        logoStorageId:
          args.logoStorageId === null
            ? undefined
            : args.logoStorageId || DEFAULT_CONVEX_BOX_CONFIG.logoStorageId,
        boxSize: args.boxSize !== undefined ? args.boxSize : DEFAULT_CONVEX_BOX_CONFIG.boxSize,
      };
      await ctx.db.insert("convexBoxConfig", newConfigData);
    }
  },
});

/**
 * Mutation to generate an upload URL for the ConvexBox logo.
 */
export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});
