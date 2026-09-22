import { query, mutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireJudgingGroupPermission } from "./adminAccess";
import { humanCriterionKey } from "./aiJudge";

// When human criteria are mirrored into the AI rubric, each one owns a
// "human-<criteriaId>" key that may carry an AI weight or an off flag on the
// group. Deleting the criterion prunes those entries so the AI settings never
// reference a criterion that no longer exists. Stored AI results keep their
// scores for the removed key; only the group-level settings are cleaned.
export async function pruneAiSettingsForDeletedCriteria(
  ctx: MutationCtx,
  groupId: Id<"judgingGroups">,
  deletedIds: Array<Id<"judgingCriteria">>,
): Promise<void> {
  if (deletedIds.length === 0) return;
  const group = await ctx.db.get(groupId);
  if (!group) return;
  const removedKeys = new Set(deletedIds.map((id) => humanCriterionKey(id)));
  const weights = (group.aiRubricWeights ?? []).filter(
    (w) => !removedKeys.has(w.key),
  );
  const disabled = (group.aiDisabledCriteria ?? []).filter(
    (key) => !removedKeys.has(key),
  );
  const weightsChanged = weights.length !== (group.aiRubricWeights ?? []).length;
  const disabledChanged =
    disabled.length !== (group.aiDisabledCriteria ?? []).length;
  if (!weightsChanged && !disabledChanged) return;
  await ctx.db.patch(groupId, {
    ...(weightsChanged
      ? { aiRubricWeights: weights.length > 0 ? weights : undefined }
      : {}),
    ...(disabledChanged
      ? { aiDisabledCriteria: disabled.length > 0 ? disabled : undefined }
      : {}),
  });
}

// Does any judge score reference this criterion? Indexed lookup so the
// delete guard never scans the judgeScores table.
async function criterionHasScores(
  ctx: MutationCtx,
  criteriaId: Id<"judgingCriteria">,
): Promise<boolean> {
  const score = await ctx.db
    .query("judgeScores")
    .withIndex("by_criteriaId", (q) => q.eq("criteriaId", criteriaId))
    .first();
  return score !== null;
}

// --- Admin Functions ---

/**
 * Get all criteria for a specific judging group
 */
export const listByGroup = query({
  args: { groupId: v.id("judgingGroups") },
  returns: v.array(
    v.object({
      _id: v.id("judgingCriteria"),
      _creationTime: v.number(),
      groupId: v.id("judgingGroups"),
      question: v.string(),
      description: v.optional(v.string()),
      weight: v.optional(v.number()),
      order: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.view");

    return await ctx.db
      .query("judgingCriteria")
      .withIndex("by_groupId_order", (q) => q.eq("groupId", args.groupId))
      .order("asc")
      .collect();
  },
});

/**
 * Bulk save/update criteria for a group
 * This replaces all existing criteria with the provided list
 */
export const saveCriteria = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    criteria: v.array(
      v.object({
        _id: v.optional(v.id("judgingCriteria")), // Optional for new criteria
        question: v.string(),
        description: v.optional(v.string()),
        weight: v.optional(v.number()),
        order: v.number(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.manage");

    // Verify the group exists
    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Judging group not found");
    }

    // Get existing criteria
    const existingCriteria = await ctx.db
      .query("judgingCriteria")
      .withIndex("by_groupId_order", (q) => q.eq("groupId", args.groupId))
      .collect();

    // Track which criteria to keep
    const criteriaToKeep = new Set<string>();

    // Process each criteria in the input
    for (const criterion of args.criteria) {
      if (criterion._id) {
        // Update existing criterion
        const existingCriterion = existingCriteria.find(
          (c) => c._id === criterion._id,
        );
        if (existingCriterion) {
          await ctx.db.patch(criterion._id, {
            question: criterion.question,
            description: criterion.description,
            weight: criterion.weight || 1, // Default to 1 if not provided
            order: criterion.order,
          });
          criteriaToKeep.add(criterion._id);
        }
      } else {
        // Create new criterion
        const newId = await ctx.db.insert("judgingCriteria", {
          groupId: args.groupId,
          question: criterion.question,
          description: criterion.description,
          weight: criterion.weight || 1, // Default to 1 if not provided
          order: criterion.order,
        });
        criteriaToKeep.add(newId);
      }
    }

    // Delete criteria that are no longer in the list
    const deletedIds: Array<Id<"judgingCriteria">> = [];
    for (const existing of existingCriteria) {
      if (!criteriaToKeep.has(existing._id)) {
        // Before deleting, check if there are any scores for this criterion
        if (await criterionHasScores(ctx, existing._id)) {
          throw new Error(
            `Cannot delete criterion "${existing.question}" because it has existing scores. Please remove all scores first.`,
          );
        }

        await ctx.db.delete(existing._id);
        deletedIds.push(existing._id);
      }
    }

    // Keep the AI rubric settings consistent with the surviving criteria
    await pruneAiSettingsForDeletedCriteria(ctx, args.groupId, deletedIds);

    return null;
  },
});

/**
 * Delete a specific criterion
 */
export const deleteCriteria = mutation({
  args: { criteriaId: v.id("judgingCriteria") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const criterionDoc = await ctx.db.get(args.criteriaId);
    if (!criterionDoc) {
      return null;
    }
    await requireJudgingGroupPermission(
      ctx,
      criterionDoc.groupId,
      "judging.manage",
    );

    // Check if there are any scores for this criterion
    if (await criterionHasScores(ctx, args.criteriaId)) {
      throw new Error(
        `Cannot delete criterion "${criterionDoc.question}" because it has existing scores. Please remove all scores first.`,
      );
    }

    await ctx.db.delete(args.criteriaId);
    await pruneAiSettingsForDeletedCriteria(ctx, criterionDoc.groupId, [
      args.criteriaId,
    ]);
    return null;
  },
});

/**
 * Reorder criteria within a group
 */
export const reorderCriteria = mutation({
  args: {
    groupId: v.id("judgingGroups"),
    criteriaOrder: v.array(
      v.object({
        criteriaId: v.id("judgingCriteria"),
        order: v.number(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireJudgingGroupPermission(ctx, args.groupId, "judging.manage");

    // Update the order for each criterion
    for (const item of args.criteriaOrder) {
      await ctx.db.patch(item.criteriaId, { order: item.order });
    }

    return null;
  },
});

// --- Public Functions (for judges) ---

/**
 * Get criteria for a group (public access for judges)
 */
export const getGroupCriteria = query({
  args: { groupId: v.id("judgingGroups") },
  returns: v.array(
    v.object({
      _id: v.id("judgingCriteria"),
      question: v.string(),
      description: v.optional(v.string()),
      weight: v.optional(v.number()),
      order: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    // No admin check - this is public for judges

    // Verify the group exists and is accessible
    const group = await ctx.db.get(args.groupId);
    if (!group || !group.isActive) {
      throw new Error("Judging group not found or inactive");
    }

    return await ctx.db
      .query("judgingCriteria")
      .withIndex("by_groupId_order", (q) => q.eq("groupId", args.groupId))
      .order("asc")
      .collect()
      .then((criteria) =>
        criteria.map((c) => ({
          _id: c._id,
          question: c.question,
          description: c.description,
          weight: c.weight,
          order: c.order,
        })),
      );
  },
});

/**
 * Get a single criterion by ID (for validation)
 */
export const getCriterion = query({
  args: { criteriaId: v.id("judgingCriteria") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("judgingCriteria"),
      groupId: v.id("judgingGroups"),
      question: v.string(),
      description: v.optional(v.string()),
      weight: v.optional(v.number()),
      order: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.criteriaId);
  },
});
