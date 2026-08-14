import {
  query,
  mutation,
  internalMutation,
  QueryCtx,
  MutationCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { requirePermission } from "./adminAccess";
import { sanitizeHackathonLog } from "./hackathonLog";

// Stories columns that admin-managed form fields may map to via
// storyPropertyName. Any other field key persists into
// stories.dynamicFormValues instead of a dedicated column.
export const STORY_DYNAMIC_COLUMNS = [
  "linkedinUrl",
  "twitterUrl",
  "githubUrl",
  "chefShowUrl",
  "chefAppUrl",
  "selfReportedHarness",
  "selfReportedModel",
  "hackathonLog",
] as const;

export type StoryDynamicColumn = (typeof STORY_DYNAMIC_COLUMNS)[number];

// Shared field type validator used by every query/mutation in this file.
// radio/select = single choice, multiselect = multiple choices (comma-joined).
export const storyFormFieldTypeValidator = v.union(
  v.literal("url"),
  v.literal("text"),
  v.literal("email"),
  v.literal("textarea"),
  v.literal("radio"),
  v.literal("multiselect"),
  v.literal("select"),
);

// Shared document shape returned by list queries.
const storyFormFieldDoc = v.object({
  _id: v.id("storyFormFields"),
  _creationTime: v.number(),
  key: v.string(),
  label: v.string(),
  placeholder: v.string(),
  isEnabled: v.boolean(),
  isRequired: v.boolean(),
  order: v.number(),
  fieldType: storyFormFieldTypeValidator,
  options: v.optional(v.array(v.string())),
  description: v.optional(v.string()),
  storyPropertyName: v.string(),
});

export type DynamicFieldEntry = { key: string; label: string; value: string };

export type ResolvedDynamicFields = {
  // Values for known stories columns (hackathonLog already sanitized)
  dynamicColumns: Partial<Record<StoryDynamicColumn, string>>;
  // Values for admin-added fields with no dedicated column
  dynamicFormValues: Array<DynamicFieldEntry> | undefined;
};

/**
 * Shared resolver used by every submit path. Maps submitted dynamic field
 * values to their stories column (via the field's storyPropertyName) when
 * one exists, otherwise into the generic dynamicFormValues array with the
 * label denormalized from the field definition. Unknown keys with no
 * matching storyFormFields definition are dropped so clients cannot store
 * arbitrary data.
 */
// Multiselect answers are stored as a single comma-joined string so every
// downstream consumer (judging UI, CSV export, AI judge context) keeps
// working with plain string values.
export const MULTISELECT_SEPARATOR = ", ";

/**
 * For radio/multiselect/select fields, keep only values that match the
 * configured options. Returns null when nothing valid remains so the entry
 * is skipped. Non-choice fields pass through unchanged.
 */
function sanitizeChoiceValue(
  field: Doc<"storyFormFields"> | null,
  value: string,
): string | null {
  if (!field) return value;
  if (
    field.fieldType !== "radio" &&
    field.fieldType !== "multiselect" &&
    field.fieldType !== "select"
  ) {
    return value;
  }
  const options = field.options ?? [];
  if (options.length === 0) return null;
  if (field.fieldType === "radio" || field.fieldType === "select") {
    return options.includes(value) ? value : null;
  }
  const selected = value
    .split(MULTISELECT_SEPARATOR)
    .map((part) => part.trim())
    .filter((part) => options.includes(part));
  // Preserve option order for stable display regardless of click order
  const ordered = options.filter((option) => selected.includes(option));
  return ordered.length > 0 ? ordered.join(MULTISELECT_SEPARATOR) : null;
}

export async function resolveDynamicFieldValues(
  ctx: QueryCtx | MutationCtx,
  entries: Array<DynamicFieldEntry> | undefined,
): Promise<ResolvedDynamicFields> {
  const dynamicColumns: Partial<Record<StoryDynamicColumn, string>> = {};
  const extras: Array<DynamicFieldEntry> = [];
  const knownColumns = new Set<string>(STORY_DYNAMIC_COLUMNS);

  for (const entry of entries ?? []) {
    const key = entry.key.trim();
    const rawValue = entry.value.trim();
    if (!key || !rawValue) continue;

    const field = await ctx.db
      .query("storyFormFields")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();

    const value = sanitizeChoiceValue(field, rawValue);
    if (value === null) continue;

    const propertyName = field?.storyPropertyName;
    if (propertyName && knownColumns.has(propertyName)) {
      const column = propertyName as StoryDynamicColumn;
      if (dynamicColumns[column] === undefined) {
        dynamicColumns[column] =
          column === "hackathonLog" ? sanitizeHackathonLog(value) : value;
      }
    } else if (!field && knownColumns.has(key)) {
      // Defensive: a known column key whose field definition was deleted
      const column = key as StoryDynamicColumn;
      if (dynamicColumns[column] === undefined) {
        dynamicColumns[column] =
          column === "hackathonLog" ? sanitizeHackathonLog(value) : value;
      }
    } else if (field) {
      extras.push({ key, label: field.label, value });
    }
  }

  return {
    dynamicColumns,
    dynamicFormValues: extras.length > 0 ? extras : undefined,
  };
}

/**
 * Record-based variant for submit paths that receive a flat formData record
 * (dynamic submit forms). Only enabled fields are considered.
 */
export async function resolveDynamicFieldRecord(
  ctx: QueryCtx | MutationCtx,
  formData: Record<string, unknown>,
): Promise<ResolvedDynamicFields> {
  const enabledFields = await ctx.db
    .query("storyFormFields")
    .withIndex("by_enabled", (q) => q.eq("isEnabled", true))
    .collect();

  const entries: Array<DynamicFieldEntry> = [];
  for (const field of enabledFields) {
    const raw = formData[field.key];
    if (typeof raw === "string" && raw.trim()) {
      entries.push({ key: field.key, label: field.label, value: raw });
    }
  }
  return resolveDynamicFieldValues(ctx, entries);
}

// Query to get all form fields ordered by display order
export const list = query({
  args: {},
  returns: v.array(storyFormFieldDoc),
  handler: async (ctx) => {
    const fields = await ctx.db
      .query("storyFormFields")
      .withIndex("by_order")
      .collect();

    return fields.sort((a, b) => a.order - b.order);
  },
});

// Query to get only enabled form fields for the story form
export const listEnabled = query({
  args: {},
  returns: v.array(storyFormFieldDoc),
  handler: async (ctx) => {
    const fields = await ctx.db
      .query("storyFormFields")
      .withIndex("by_enabled", (q) => q.eq("isEnabled", true))
      .collect();

    return fields.sort((a, b) => a.order - b.order);
  },
});

// Admin query: per-option answer counts for every choice field. Counts come
// from stories.dynamicFormValues (where admin-added choice answers live).
// Multiselect answers count each selected option once; totals count stories
// that answered the field at all. Scans the stories table, which is fine at
// this app's scale for a single admin dashboard subscription.
export const getChoiceAnswerCounts = query({
  args: {},
  returns: v.record(
    v.string(),
    v.object({
      total: v.number(),
      counts: v.array(v.object({ option: v.string(), count: v.number() })),
    }),
  ),
  handler: async (ctx) => {
    await requirePermission(ctx, "forms.view");

    const fields = await ctx.db
      .query("storyFormFields")
      .withIndex("by_order")
      .collect();
    const choiceFields = fields.filter(
      (field) =>
        (field.fieldType === "radio" ||
          field.fieldType === "multiselect" ||
          field.fieldType === "select") &&
        (field.options ?? []).length > 0,
    );
    if (choiceFields.length === 0) {
      return {};
    }

    // key -> option -> count, seeded with zeros so every option shows a bar
    const fieldByKey = new Map(choiceFields.map((field) => [field.key, field]));
    const optionCounts: Record<string, Record<string, number>> = {};
    const totals: Record<string, number> = {};
    for (const field of choiceFields) {
      optionCounts[field.key] = {};
      totals[field.key] = 0;
      for (const option of field.options ?? []) {
        optionCounts[field.key][option] = 0;
      }
    }

    for await (const story of ctx.db.query("stories")) {
      for (const entry of story.dynamicFormValues ?? []) {
        const field = fieldByKey.get(entry.key);
        if (!field) continue;
        const parts =
          field.fieldType === "multiselect"
            ? entry.value
                .split(MULTISELECT_SEPARATOR)
                .map((part) => part.trim())
            : [entry.value.trim()];
        let matched = false;
        for (const part of parts) {
          if (part in optionCounts[entry.key]) {
            optionCounts[entry.key][part] += 1;
            matched = true;
          }
        }
        if (matched) totals[entry.key] += 1;
      }
    }

    const result: Record<
      string,
      { total: number; counts: Array<{ option: string; count: number }> }
    > = {};
    for (const field of choiceFields) {
      result[field.key] = {
        total: totals[field.key],
        counts: (field.options ?? []).map((option) => ({
          option,
          count: optionCounts[field.key][option],
        })),
      };
    }
    return result;
  },
});

// Admin query to get all form fields
export const listAdmin = query({
  args: {},
  returns: v.array(storyFormFieldDoc),
  handler: async (ctx) => {
    await requirePermission(ctx, "forms.view");
    const fields = await ctx.db
      .query("storyFormFields")
      .withIndex("by_order")
      .collect();

    return fields.sort((a, b) => a.order - b.order);
  },
});

// Create a new form field
export const create = mutation({
  args: {
    key: v.string(),
    label: v.string(),
    placeholder: v.string(),
    isEnabled: v.boolean(),
    isRequired: v.boolean(),
    order: v.number(),
    fieldType: storyFormFieldTypeValidator,
    options: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
    storyPropertyName: v.string(),
  },
  returns: v.id("storyFormFields"),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "forms.manage");

    // Check if key already exists
    const existing = await ctx.db
      .query("storyFormFields")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      throw new Error(`Form field with key "${args.key}" already exists`);
    }

    return await ctx.db.insert("storyFormFields", args);
  },
});

// Update a form field
export const update = mutation({
  args: {
    fieldId: v.id("storyFormFields"),
    key: v.optional(v.string()),
    label: v.optional(v.string()),
    placeholder: v.optional(v.string()),
    isEnabled: v.optional(v.boolean()),
    isRequired: v.optional(v.boolean()),
    order: v.optional(v.number()),
    fieldType: v.optional(storyFormFieldTypeValidator),
    options: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
    storyPropertyName: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "forms.manage");

    const { fieldId, ...updates } = args;

    // If updating key, check for conflicts
    if (updates.key) {
      const keyToCheck = updates.key;
      const existing = await ctx.db
        .query("storyFormFields")
        .withIndex("by_key", (q) => q.eq("key", keyToCheck))
        .filter((q) => q.neq(q.field("_id"), fieldId))
        .first();

      if (existing) {
        throw new Error(`Form field with key "${keyToCheck}" already exists`);
      }
    }

    // Only update fields that were provided
    const updateData: Partial<Doc<"storyFormFields">> = {};
    if (updates.key !== undefined) updateData.key = updates.key;
    if (updates.label !== undefined) updateData.label = updates.label;
    if (updates.placeholder !== undefined)
      updateData.placeholder = updates.placeholder;
    if (updates.isEnabled !== undefined)
      updateData.isEnabled = updates.isEnabled;
    if (updates.isRequired !== undefined)
      updateData.isRequired = updates.isRequired;
    if (updates.order !== undefined) updateData.order = updates.order;
    if (updates.fieldType !== undefined)
      updateData.fieldType = updates.fieldType;
    if (updates.options !== undefined) updateData.options = updates.options;
    if (updates.description !== undefined)
      updateData.description = updates.description;
    if (updates.storyPropertyName !== undefined)
      updateData.storyPropertyName = updates.storyPropertyName;

    await ctx.db.patch(fieldId, updateData);
    return null;
  },
});

// Delete a form field
export const deleteField = mutation({
  args: {
    fieldId: v.id("storyFormFields"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "forms.delete");
    await ctx.db.delete(args.fieldId);
    return null;
  },
});

// Reorder form fields
export const reorder = mutation({
  args: {
    fieldIds: v.array(v.id("storyFormFields")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(ctx, "forms.manage");

    // Update order for each field
    for (let i = 0; i < args.fieldIds.length; i++) {
      await ctx.db.patch(args.fieldIds[i], { order: i });
    }

    return null;
  },
});

// Internal mutation to ensure GitHub field is optional
export const ensureGitHubFieldOptional = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Find the GitHub field
    const githubField = await ctx.db
      .query("storyFormFields")
      .filter((q) => q.eq(q.field("key"), "githubUrl"))
      .first();

    if (githubField && githubField.isRequired) {
      await ctx.db.patch(githubField._id, { isRequired: false });
      console.log("Updated GitHub field to be optional");
    }

    return null;
  },
});

// Internal mutation to initialize default form fields
export const initializeDefaultFields = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Check if any form fields exist
    const existingFields = await ctx.db.query("storyFormFields").take(1);
    if (existingFields.length > 0) {
      return null; // Already initialized
    }

    // Create default form fields
    const defaultFields = [
      {
        key: "linkedinUrl",
        label: "LinkedIn Profile or LinkedIn Announcement Post URL (Optional)",
        placeholder: "https://linkedin.com/...",
        isEnabled: true,
        isRequired: false,
        order: 0,
        fieldType: "url" as const,
        description: "LinkedIn profile or announcement post URL",
        storyPropertyName: "linkedinUrl",
      },
      {
        key: "twitterUrl",
        label:
          "X (Twitter) or Bluesky Profile or Announcement Post URL (Optional)",
        placeholder: "https://twitter.com/...",
        isEnabled: true,
        isRequired: false,
        order: 1,
        fieldType: "url" as const,
        description: "X (Twitter) or Bluesky profile or announcement post URL",
        storyPropertyName: "twitterUrl",
      },
      {
        key: "githubUrl",
        label: "GitHub Repo URL (Optional)",
        placeholder: "https://github.com/...",
        isEnabled: true,
        isRequired: false,
        order: 2,
        fieldType: "url" as const,
        description: "GitHub repository URL",
        storyPropertyName: "githubUrl",
      },
      {
        key: "chefAppUrl",
        label: "Chef deployment convex.app link (Optional)",
        placeholder: "https://chef.app/...",
        isEnabled: true,
        isRequired: false,
        order: 3,
        fieldType: "url" as const,
        description: "Chef deployment convex.app link",
        storyPropertyName: "chefAppUrl",
      },
      {
        key: "chefShowUrl",
        label: "Convexchef.show project link (Optional)",
        placeholder: "https://chef.show/...",
        isEnabled: true,
        isRequired: false,
        order: 4,
        fieldType: "url" as const,
        description: "Convexchef.show project link",
        storyPropertyName: "chefShowUrl",
      },
      {
        key: "selfReportedHarness",
        label: "AI coding tool used (Optional)",
        placeholder: "cursor, claude-code, windsurf...",
        isEnabled: false,
        isRequired: false,
        order: 5,
        fieldType: "text" as const,
        description:
          "Which AI coding tool you used to build this (self-reported)",
        storyPropertyName: "selfReportedHarness",
      },
      {
        key: "selfReportedModel",
        label: "AI model used (Optional)",
        placeholder: "claude-sonnet-4-5, gpt-5...",
        isEnabled: false,
        isRequired: false,
        order: 6,
        fieldType: "text" as const,
        description: "Which AI model you used to build this (self-reported)",
        storyPropertyName: "selfReportedModel",
      },
      {
        key: "hackathonLog",
        label: "Hackathon log (hackathon.md)",
        placeholder: "Paste the full contents of your hackathon.md here...",
        isEnabled: false,
        isRequired: false,
        order: 7,
        fieldType: "textarea" as const,
        description:
          "Private or no repo? Paste the contents of your hackathon.md here. Public repos can skip this; we read the file from your repo.",
        storyPropertyName: "hackathonLog",
      },
    ];

    for (const field of defaultFields) {
      await ctx.db.insert("storyFormFields", field);
    }

    return null;
  },
});

// Internal mutation to add the hackathonLog paste field to existing
// deployments (initializeDefaultFields only runs on empty tables).
// Ships disabled; an admin turns it on for a hackathon form.
export const ensureHackathonLogField = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("storyFormFields")
      .withIndex("by_key", (q) => q.eq("key", "hackathonLog"))
      .first();
    if (existing) return null;

    await ctx.db.insert("storyFormFields", {
      key: "hackathonLog",
      label: "Hackathon log (hackathon.md)",
      placeholder: "Paste the full contents of your hackathon.md here...",
      isEnabled: false,
      isRequired: false,
      order: 92,
      fieldType: "textarea" as const,
      description:
        "Private or no repo? Paste the contents of your hackathon.md here. Public repos can skip this; we read the file from your repo.",
      storyPropertyName: "hackathonLog",
    });

    return null;
  },
});

// Internal mutation to add the self-reported AI attribution fields to
// existing deployments (initializeDefaultFields only runs on empty tables).
// Fields are created disabled so admins opt in per event.
export const ensureAiAttributionFields = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const attributionFields = [
      {
        key: "selfReportedHarness",
        label: "AI coding tool used (Optional)",
        placeholder: "cursor, claude-code, windsurf...",
        isEnabled: false,
        isRequired: false,
        order: 90,
        fieldType: "text" as const,
        description:
          "Which AI coding tool you used to build this (self-reported)",
        storyPropertyName: "selfReportedHarness",
      },
      {
        key: "selfReportedModel",
        label: "AI model used (Optional)",
        placeholder: "claude-sonnet-4-5, gpt-5...",
        isEnabled: false,
        isRequired: false,
        order: 91,
        fieldType: "text" as const,
        description: "Which AI model you used to build this (self-reported)",
        storyPropertyName: "selfReportedModel",
      },
    ];

    for (const field of attributionFields) {
      const existing = await ctx.db
        .query("storyFormFields")
        .withIndex("by_key", (q) => q.eq("key", field.key))
        .first();
      if (!existing) {
        await ctx.db.insert("storyFormFields", field);
      }
    }

    return null;
  },
});
