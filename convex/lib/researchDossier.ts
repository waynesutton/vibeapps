import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { rankCompletedAiResults } from "./aiRank";
import { isInJudgeQueue } from "./judgeQueue";
import { AI_FRONTEND_PLATFORMS, getRubricForGroup } from "../aiJudge";

/**
 * Markdown builders for the judging research chat. The indexer stores one
 * dossier per submission; the chat tools rebuild the same dossier from live
 * data, so both paths always describe a submission identically.
 *
 * Privacy: dossiers never include submitter or team emails. Self reported
 * harness/model fields and harness signals are organizer metadata that must
 * not steer judging, so they are left out too.
 */

export const SITE_URL = "https://vibeapps.dev";

// Caps keep a single dossier well under the 1MB document limit and keep the
// model context focused on evidence rather than raw dumps.
const CAP_DESCRIPTION = 2500;
const CAP_FORM_ANSWER = 500;
const CAP_COMMENT = 600;
const CAP_NOTE = 400;
const CAP_AI_CRITERION = 400;
const CAP_AI_OVERALL = 1500;
const CAP_SOCIAL_TEXT = 300;
const CAP_TRANSCRIPT = 1200;
const CAP_DIGEST_ROWS = 150;

export type GroupContext = {
  group: Doc<"judgingGroups">;
  criteria: Array<Doc<"judgingCriteria">>;
  judgesById: Map<Id<"judges">, Doc<"judges">>;
};

export type SubmissionBundle = {
  story: Doc<"stories">;
  membership: Doc<"judgingGroupSubmissions">;
  status: Doc<"submissionStatuses"> | null;
  scores: Array<Doc<"judgeScores">>;
  notes: Array<Doc<"submissionNotes">>;
  aiResult: Doc<"aiJudgeResults"> | null;
  socialProof: Array<Doc<"socialProofSnapshots">>;
  transcript: Doc<"videoTranscripts"> | null;
  tagNames: Array<string>;
};

export function isStoryValidForJudging(
  story: Doc<"stories"> | null,
): story is Doc<"stories"> {
  if (!story) return false;
  if (story.isHidden === true) return false;
  if (story.isArchived === true) return false;
  if (story.status === "rejected") return false;
  return true;
}

function clip(text: string | undefined, max: number): string {
  if (!text) return "";
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}...` : trimmed;
}

function oneLine(text: string | undefined, max: number): string {
  return clip(text?.replace(/\s+/g, " "), max);
}

function fmtDate(ms: number | undefined): string {
  if (!ms) return "unknown";
  return new Date(ms).toISOString().slice(0, 10);
}

function round(n: number | undefined, digits = 2): string {
  if (n === undefined || Number.isNaN(n)) return "n/a";
  const f = 10 ** digits;
  return String(Math.round(n * f) / f);
}

export function storyPageUrl(story: Pick<Doc<"stories">, "slug">): string {
  return `${SITE_URL}/s/${story.slug}`;
}

// --- Loaders (queries and mutations) ---

export async function loadGroupContext(
  ctx: QueryCtx,
  groupId: Id<"judgingGroups">,
): Promise<GroupContext | null> {
  const group = await ctx.db.get(groupId);
  if (!group) return null;
  const [criteria, judges] = await Promise.all([
    ctx.db
      .query("judgingCriteria")
      .withIndex("by_groupId_order", (q) => q.eq("groupId", groupId))
      .collect(),
    ctx.db
      .query("judges")
      .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
      .collect(),
  ]);
  return {
    group,
    criteria,
    judgesById: new Map(judges.map((judge) => [judge._id, judge])),
  };
}

export async function loadSubmissionBundle(
  ctx: QueryCtx,
  groupId: Id<"judgingGroups">,
  membership: Doc<"judgingGroupSubmissions">,
): Promise<SubmissionBundle | null> {
  const story = await ctx.db.get(membership.storyId);
  if (!isStoryValidForJudging(story)) return null;
  const storyId = story._id;

  const [status, scores, notes, aiResult, socialProof, transcript, tags] =
    await Promise.all([
      ctx.db
        .query("submissionStatuses")
        .withIndex("by_groupId_storyId", (q) =>
          q.eq("groupId", groupId).eq("storyId", storyId),
        )
        .first(),
      ctx.db
        .query("judgeScores")
        .withIndex("by_groupId_storyId", (q) =>
          q.eq("groupId", groupId).eq("storyId", storyId),
        )
        .collect(),
      ctx.db
        .query("submissionNotes")
        .withIndex("by_groupId_storyId", (q) =>
          q.eq("groupId", groupId).eq("storyId", storyId),
        )
        .take(50),
      ctx.db
        .query("aiJudgeResults")
        .withIndex("by_groupId_storyId", (q) =>
          q.eq("groupId", groupId).eq("storyId", storyId),
        )
        .first(),
      ctx.db
        .query("socialProofSnapshots")
        .withIndex("by_story", (q) => q.eq("storyId", storyId))
        .take(4),
      ctx.db
        .query("videoTranscripts")
        .withIndex("by_story", (q) => q.eq("storyId", storyId))
        .first(),
      Promise.all(story.tagIds.map(async (tagId) => await ctx.db.get(tagId))),
    ]);

  return {
    story,
    membership,
    status,
    scores: scores.filter((score) => score.isHidden !== true),
    notes,
    aiResult,
    socialProof,
    transcript,
    tagNames: tags
      .filter((tag): tag is Doc<"tags"> => tag !== null)
      .map((tag) => tag.name),
  };
}

// --- Submission dossier ---

export function buildSubmissionDossier(
  gc: GroupContext,
  bundle: SubmissionBundle,
): string {
  const { story, membership, status, scores, notes, aiResult } = bundle;
  const scale = gc.group.scoreScale ?? 10;
  const lines: Array<string> = [];

  // Identity and links
  lines.push(`## ${story.title}`);
  lines.push(`- Submission id: ${story._id}`);
  lines.push(`- Page: ${storyPageUrl(story)}`);
  if (story.url) lines.push(`- Live app: ${story.url}`);
  if (story.githubUrl) lines.push(`- Repo: ${story.githubUrl}`);
  if (story.videoUrl) lines.push(`- Video: ${story.videoUrl}`);
  if (story.twitterUrl) lines.push(`- X / social post: ${story.twitterUrl}`);
  if (story.linkedinUrl) lines.push(`- LinkedIn: ${story.linkedinUrl}`);
  if (story.chefAppUrl) lines.push(`- Chef app: ${story.chefAppUrl}`);
  if (story.teamName || story.teamMembers?.length) {
    const names = (story.teamMembers ?? []).map((m) => m.name).join(", ");
    lines.push(
      `- Team: ${story.teamName ?? "unnamed"}${
        story.teamMemberCount ? ` (${story.teamMemberCount} members)` : ""
      }${names ? `: ${names}` : ""}`,
    );
  }
  if (story.submitterName) lines.push(`- Submitter: ${story.submitterName}`);
  if (bundle.tagNames.length > 0) {
    lines.push(`- Tags: ${bundle.tagNames.join(", ")}`);
  }
  lines.push(`- Submitted: ${fmtDate(story._creationTime)}`);
  lines.push(
    `- In judge queue: ${isInJudgeQueue(gc.group, membership) ? "yes" : "no"}${
      membership.shortlisted ? " (shortlisted)" : ""
    }`,
  );
  lines.push(`- Human judging status: ${status?.status ?? "pending"}`);

  // Description
  lines.push("", "### Description");
  lines.push(clip(story.description, 500) || "No tagline.");
  if (story.longDescription) {
    lines.push("", clip(story.longDescription, CAP_DESCRIPTION));
  }

  const answers = [
    ...(story.customFormAnswers ?? []),
    ...(story.dynamicFormValues ?? []),
  ].filter((answer) => answer.value.trim().length > 0);
  if (answers.length > 0) {
    lines.push("", "### Form answers");
    for (const answer of answers) {
      lines.push(`- ${answer.label}: ${oneLine(answer.value, CAP_FORM_ANSWER)}`);
    }
  }

  // Human judging
  lines.push("", `### Human judge scores (scale 1 to ${scale})`);
  if (scores.length === 0) {
    lines.push("No human scores yet.");
  } else {
    const advisory = gc.group.agentScoresAdvisory ?? true;
    const counted = scores.filter(
      (s) => !(advisory && gc.judgesById.get(s.judgeId)?.type === "agent"),
    );
    const total = counted.reduce((sum, s) => sum + s.score, 0);
    const judgeIds = new Set(counted.map((s) => s.judgeId));
    lines.push(
      `- Total ${round(total)} from ${counted.length} scores by ${judgeIds.size} judges, average ${round(
        counted.length > 0 ? total / counted.length : undefined,
      )}`,
    );
    for (const criterion of gc.criteria) {
      const forCriterion = counted.filter((s) => s.criteriaId === criterion._id);
      if (forCriterion.length === 0) continue;
      const avg =
        forCriterion.reduce((sum, s) => sum + s.score, 0) / forCriterion.length;
      lines.push(
        `- ${criterion.question}: average ${round(avg)} (${forCriterion.length} judges)`,
      );
    }
    // Per judge breakdown with comments
    const byJudge = new Map<Id<"judges">, Array<Doc<"judgeScores">>>();
    for (const score of scores) {
      const list = byJudge.get(score.judgeId) ?? [];
      list.push(score);
      byJudge.set(score.judgeId, list);
    }
    const criteriaById = new Map(gc.criteria.map((c) => [c._id, c]));
    for (const [judgeId, judgeScores] of byJudge) {
      const judge = gc.judgesById.get(judgeId);
      const isAgent = judge?.type === "agent";
      lines.push(
        `- Judge ${judge?.name ?? "unknown"}${
          isAgent ? (advisory ? " (agent, advisory, not ranked)" : " (agent)") : ""
        }:`,
      );
      for (const score of judgeScores) {
        const question = criteriaById.get(score.criteriaId)?.question ?? "criterion";
        const comment = score.comments
          ? ` | comment: ${oneLine(score.comments, CAP_COMMENT)}`
          : "";
        lines.push(`  - ${question}: ${score.score}${comment}`);
      }
    }
  }

  if (notes.length > 0) {
    lines.push("", "### Judge notes");
    for (const note of notes) {
      const judge = gc.judgesById.get(note.judgeId);
      lines.push(
        `- ${judge?.name ?? "Judge"}${note.replyToId ? " (reply)" : ""}: ${oneLine(
          note.content,
          CAP_NOTE,
        )}`,
      );
    }
  }

  // AI judge
  lines.push("", "### AI judge review");
  if (!aiResult) {
    lines.push("Not reviewed by the AI judge.");
  } else if (aiResult.status !== "completed") {
    lines.push(
      `Status: ${aiResult.status}${aiResult.error ? ` (${oneLine(aiResult.error, 200)})` : ""}`,
    );
  } else {
    lines.push(
      `- Total ${round(aiResult.totalScore)}, average ${round(aiResult.averageScore)} (1 to 10 per criterion)${
        aiResult.judgeModel ? `, model ${aiResult.judgeModel}` : ""
      }${aiResult.editedAt ? ", scores edited by an admin" : ""}`,
    );
    for (const cs of aiResult.criteriaScores ?? []) {
      lines.push(
        `- ${cs.label}: ${cs.score} | ${oneLine(cs.reasoning, CAP_AI_CRITERION)}`,
      );
    }
    if (aiResult.overallReasoning) {
      lines.push("", `Overall: ${clip(aiResult.overallReasoning, CAP_AI_OVERALL)}`);
    }
    const facts: Array<string> = [];
    if (aiResult.repoAccess) facts.push(`repo ${aiResult.repoAccess}`);
    if (aiResult.urlCheck) {
      facts.push(
        `live URL ${aiResult.urlCheck.isLive ? "up" : "down"} (${aiResult.urlCheck.note})`,
      );
    }
    if (aiResult.frontendHosting) {
      facts.push(`hosting ${aiResult.frontendHosting.platform}`);
    }
    if (aiResult.authProvider) facts.push(`auth ${aiResult.authProvider}`);
    if (aiResult.usesAiGateway) facts.push("uses Convex AI Gateway");
    if (facts.length > 0) lines.push(`- Facts: ${facts.join("; ")}`);
    if (aiResult.convexFeaturesDetected?.length) {
      lines.push(`- Convex features: ${aiResult.convexFeaturesDetected.join(", ")}`);
    }
    if (aiResult.componentsUsed?.length) {
      lines.push(`- Components used: ${aiResult.componentsUsed.join(", ")}`);
    }
    if (aiResult.sponsorStack?.length) {
      lines.push(
        `- Sponsor stack: ${aiResult.sponsorStack
          .map((s) => `${s.sponsor} via ${s.via.join("/")}`)
          .join(", ")}`,
      );
    }
    const rf = aiResult.repoFacts;
    if (rf) {
      lines.push(
        `- Repo facts: ${rf.convexFileCount} Convex files, ${rf.tableCount} tables, ${rf.indexCount} indexes, ${rf.queryCount} queries, ${rf.mutationCount} mutations, ${rf.actionCount} actions${
          rf.usesVectorSearch ? ", vector search" : ""
        }${rf.usesScheduler ? ", scheduler" : ""}${rf.usesAuth ? ", auth" : ""}`,
      );
    }
    const gf = aiResult.gitFacts;
    if (gf) {
      lines.push(
        `- Git: ${gf.commitCount}${gf.commitCountCapped ? "+" : ""} commits over ${gf.activeDayCount} active days by ${gf.contributorCount} contributors, first ${fmtDate(
          gf.firstCommitAt,
        )}, last ${fmtDate(gf.lastCommitAt)}, built during event: ${gf.builtDuringEvent}${
          gf.isFork ? `, fork of ${gf.parentRepo ?? "another repo"}` : ""
        }`,
      );
    }
    if (aiResult.logDiscrepancies?.length) {
      lines.push(`- hackathon.md discrepancies: ${aiResult.logDiscrepancies.join("; ")}`);
    }
    if (aiResult.secondOpinion) {
      lines.push(
        `- Jev second opinion (advisory): ${aiResult.secondOpinion.scores
          .map((s) => `${s.key} ${s.score}`)
          .join(", ")}`,
      );
    }
  }

  if (bundle.socialProof.length > 0) {
    lines.push("", "### Social proof");
    for (const snap of bundle.socialProof) {
      const metrics = [
        snap.likes !== undefined ? `${snap.likes} likes` : null,
        snap.reposts !== undefined ? `${snap.reposts} reposts` : null,
        snap.replies !== undefined ? `${snap.replies} replies` : null,
      ]
        .filter(Boolean)
        .join(", ");
      lines.push(
        `- ${snap.platform} ${snap.kind} (${snap.status}, ${snap.live ? "live" : "not live"})${
          metrics ? `: ${metrics}` : ""
        }${snap.text ? ` | "${oneLine(snap.text, CAP_SOCIAL_TEXT)}"` : ""}`,
      );
    }
  }

  const transcript = bundle.transcript;
  if (transcript && transcript.markdown) {
    lines.push("", "### Video demo (transcript excerpt, unverified narrative)");
    if (transcript.metadata?.title) lines.push(`Title: ${transcript.metadata.title}`);
    lines.push(clip(transcript.markdown, CAP_TRANSCRIPT));
  }

  return lines.join("\n");
}

// --- Leaderboards (computed live from current data) ---

export type HumanRankRow = {
  rank: number;
  storyId: Id<"stories">;
  title: string;
  slug: string;
  totalScore: number;
  averageScore: number;
  scoreCount: number;
  completed: boolean;
};

export type AiRankRow = {
  rank: number;
  storyId: Id<"stories">;
  title: string;
  slug: string;
  averageScore?: number;
  weightedScore?: number;
  summary: string;
};

export type GroupSnapshot = {
  gc: GroupContext;
  stories: Array<Doc<"stories">>;
  queueCount: number;
  completedCount: number;
  human: Array<HumanRankRow>;
  ai: Array<AiRankRow>;
  aiStatusCounts: Record<string, number>;
};

/**
 * Read every submission, status, score, and AI result for a group and rank
 * them. Human ranking mirrors judgeScores.getGroupScores: only submissions
 * marked completed count, hidden scores are dropped, and agent scores are
 * excluded while agent scores are advisory. AI ranking uses aiRank.ts so it
 * matches the AI results page exactly.
 */
export async function loadGroupSnapshot(
  ctx: QueryCtx,
  gc: GroupContext,
): Promise<GroupSnapshot> {
  const groupId = gc.group._id;
  const [memberships, statuses, allScores, aiRows] = await Promise.all([
    ctx.db
      .query("judgingGroupSubmissions")
      .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
      .collect(),
    ctx.db
      .query("submissionStatuses")
      .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
      .collect(),
    ctx.db
      .query("judgeScores")
      .withIndex("by_groupId_storyId", (q) => q.eq("groupId", groupId))
      .collect(),
    ctx.db
      .query("aiJudgeResults")
      .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
      .collect(),
  ]);

  const storyDocs = await Promise.all(
    memberships.map(async (m) => await ctx.db.get(m.storyId)),
  );
  const valid: Array<{
    membership: Doc<"judgingGroupSubmissions">;
    story: Doc<"stories">;
  }> = [];
  memberships.forEach((membership, index) => {
    const story = storyDocs[index];
    if (isStoryValidForJudging(story)) valid.push({ membership, story });
  });
  const storyById = new Map(valid.map((row) => [row.story._id, row.story]));

  const completedIds = new Set(
    statuses.filter((s) => s.status === "completed").map((s) => s.storyId),
  );
  const advisory = gc.group.agentScoresAdvisory ?? true;
  const counted = allScores.filter(
    (s) =>
      s.isHidden !== true &&
      completedIds.has(s.storyId) &&
      !(advisory && gc.judgesById.get(s.judgeId)?.type === "agent"),
  );

  const queue = valid.filter((row) => isInJudgeQueue(gc.group, row.membership));
  const human = queue
    .map((row) => {
      const mine = counted.filter((s) => s.storyId === row.story._id);
      const totalScore = mine.reduce((sum, s) => sum + s.score, 0);
      return {
        rank: 0,
        storyId: row.story._id,
        title: row.story.title,
        slug: row.story.slug,
        totalScore,
        averageScore: mine.length > 0 ? totalScore / mine.length : 0,
        scoreCount: mine.length,
        completed: completedIds.has(row.story._id),
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  const validAiRows = aiRows.filter((row) => storyById.has(row.storyId));
  const aiRanks = rankCompletedAiResults(validAiRows, gc.group);
  const aiRowByStory = new Map(validAiRows.map((row) => [row.storyId, row]));
  const ai: Array<AiRankRow> = [];
  for (const [storyId, entry] of aiRanks) {
    const story = storyById.get(storyId);
    if (!story) continue;
    ai.push({
      rank: entry.rank,
      storyId,
      title: story.title,
      slug: story.slug,
      averageScore: entry.averageScore,
      weightedScore: entry.weightedScore,
      summary: oneLine(aiRowByStory.get(storyId)?.overallReasoning, 220),
    });
  }
  ai.sort((a, b) => a.rank - b.rank);

  const aiStatusCounts: Record<string, number> = {};
  for (const row of validAiRows) {
    aiStatusCounts[row.status] = (aiStatusCounts[row.status] ?? 0) + 1;
  }

  return {
    gc,
    stories: valid.map((row) => row.story),
    queueCount: queue.length,
    completedCount: queue.filter((row) => completedIds.has(row.story._id))
      .length,
    human,
    ai,
    aiStatusCounts,
  };
}

function storyLink(title: string, slug: string): string {
  return `[${title.replace(/[[\]]/g, "")}](${SITE_URL}/s/${slug})`;
}

export function buildOverviewDoc(snap: GroupSnapshot): string {
  const { group, criteria, judgesById } = snap.gc;
  const judges = [...judgesById.values()];
  const humanJudges = judges.filter((j) => j.type !== "agent").length;
  const agentJudges = judges.length - humanJudges;
  const lines: Array<string> = [];
  lines.push(`# ${group.name}`);
  if (group.description) lines.push(group.description);
  lines.push(
    `- Event window: ${fmtDate(group.startDate)} to ${fmtDate(group.endDate)}`,
    `- Submissions: ${snap.stories.length} valid, ${snap.queueCount} in the human judge queue (${
      group.judgeQueueMode ?? "all"
    } mode)`,
    `- Human judging: ${snap.completedCount} of ${snap.queueCount} submissions marked completed, ${humanJudges} human judges${
      agentJudges > 0
        ? `, ${agentJudges} agent judges (${(group.agentScoresAdvisory ?? true) ? "advisory, not ranked" : "ranked"})`
        : ""
    }`,
    `- Score scale: 1 to ${group.scoreScale ?? 10} per criterion. Human rank = total of counted scores.`,
    `- AI judge: ${group.aiJudgeEnabled ? "enabled" : "disabled"}; results ${
      Object.entries(snap.aiStatusCounts)
        .map(([status, count]) => `${count} ${status}`)
        .join(", ") || "none"
    }. AI rank = weighted criterion total (1 to 10 per criterion).`,
    `- Human criteria: ${criteria.length}. Full rules, criteria, and the AI rubric are in the rules document.`,
  );
  return lines.join("\n");
}

const CAP_RULES_TEXT = 20000;
const CAP_PAGE_COPY = 4000;
const CAP_ORGANIZER_NOTE = 2000;
const CAP_AI_PROMPT = 3000;

function weightLabel(weight: number | undefined): string {
  return weight !== undefined && weight !== 1 ? ` (weight ${weight})` : "";
}

/**
 * How this group is judged, built live from the group: organizer rules,
 * submit page copy, How to judge notes, queue settings, human criteria in
 * full, the effective AI rubric with weights, and custom questions. Never
 * includes passwords or the access code note.
 */
export function buildRulesDoc(gc: GroupContext): string {
  const { group, criteria } = gc;
  const lines: Array<string> = [`# Rules and rubric: ${group.name}`];

  // Organizer rules first: they override anything inferred elsewhere
  const context = clip(group.researchContext, CAP_RULES_TEXT);
  const legacyRules = clip(group.hackathonRules, CAP_RULES_TEXT);
  if (context || legacyRules) {
    lines.push("", "## Organizer rules and context");
    if (context) lines.push(context);
    if (legacyRules) lines.push("", "### Hackathon rules (legacy)", legacyRules);
  }

  // Submit page copy is where many organizers write eligibility and rules
  const pageTitle = group.submissionPageTitle?.trim();
  const pageCopy = clip(group.submissionPageDescription, CAP_PAGE_COPY);
  const pageLinks = group.submissionPageLinks ?? [];
  if (group.hasCustomSubmissionPage && (pageTitle || pageCopy || pageLinks.length)) {
    lines.push("", "## Submit page");
    lines.push(`- URL: ${SITE_URL}/judging/${group.slug}/submit`);
    if (pageTitle) lines.push(`- Title: ${pageTitle}`);
    for (const link of pageLinks) lines.push(`- Link: [${link.label}](${link.url})`);
    if (pageCopy) lines.push("", pageCopy);
  }

  // Judging setup and the organizer's How to judge notes
  const htj = group.howToJudge;
  lines.push("", "## Judging setup");
  if (htj && htj.enabled !== false) {
    lines.push(`- How to judge page: ${SITE_URL}/judging/${group.slug}/howtojudge`);
  }
  lines.push(
    `- Event window: ${fmtDate(group.startDate)} to ${fmtDate(group.endDate)} (end is the submission deadline; later entries are labeled late, eligibility is the organizer's call)`,
  );
  if (htj?.deadlineAt) lines.push(`- Judging deadline: ${fmtDate(htj.deadlineAt)}`);
  lines.push(
    `- Judges per submission: ${group.judgesPerSubmission ?? 1}`,
    `- Judge queue: ${
      group.judgeQueueMode === "shortlist"
        ? `shortlist only (below the cut ${group.showBelowCutToJudges ? "visible read only" : "hidden"} to judges)`
        : "all submissions"
    }`,
    `- Agent judge scores: ${(group.agentScoresAdvisory ?? true) ? "advisory, excluded from rankings" : "counted in rankings"}`,
  );
  const noteSections: Array<[string, string | undefined]> = [
    ["Contact", htj?.contact],
    ["Judge assignments", htj?.assignments],
    ["Private repos", htj?.privateRepoNote],
    ["Organizer notes", htj?.notes],
  ];
  for (const [label, text] of noteSections) {
    const body = clip(text, CAP_ORGANIZER_NOTE);
    if (body) lines.push("", `### ${label}`, body);
  }
  for (const link of htj?.links ?? []) {
    lines.push(`- Organizer link: [${link.label}](${link.url})`);
  }

  // Human criteria in full
  const scale = group.scoreScale ?? 10;
  lines.push("", `## Human judging criteria (each scored 1 to ${scale})`);
  if (criteria.length === 0) {
    lines.push("No human criteria configured.");
  } else {
    for (const c of criteria) {
      lines.push(`- **${c.question}**${weightLabel(c.weight)}${c.description ? `: ${c.description.trim()}` : ""}`);
    }
    lines.push("Human rank = total of counted scores from submissions marked completed.");
  }

  // AI rubric: same source the analysis uses, so labels and weights match
  lines.push("", "## AI judge rubric (each scored 1 to 10)");
  if (!group.aiJudgeEnabled) {
    lines.push("The AI judge is off for this group.");
  } else {
    const weights = new Map((group.aiRubricWeights ?? []).map((w) => [w.key, w.weight]));
    for (const c of getRubricForGroup(group, criteria)) {
      lines.push(`- **${c.label}** [${c.key}]${weightLabel(weights.get(c.key))}: ${c.description}`);
    }
    const disabled = group.aiDisabledCriteria ?? [];
    if (disabled.length > 0) lines.push(`- Switched off: ${disabled.join(", ")}`);
    const frontend = group.aiFrontendWeights ?? [];
    if (frontend.length > 0) {
      const byKey = new Map(frontend.map((w) => [w.key, w.weight]));
      lines.push(
        `- Frontend hosting weights: ${AI_FRONTEND_PLATFORMS.map((p) => `${p.label} ${byKey.get(p.key) ?? 1}`).join(", ")}`,
      );
    }
    lines.push(
      "AI rank = weighted criterion total. The AI judge is advisory; human results are the official outcome.",
      `- Second opinion (Jev): ${group.aiSecondOpinionEnabled ? "on, advisory only" : "off"}`,
      `- AI review shown to human judges: ${group.aiReviewVisibleToJudges ? "yes" : "no"}`,
    );
    const prompt = clip(group.aiJudgeSystemPrompt, CAP_AI_PROMPT);
    lines.push(
      prompt
        ? `\n### Custom AI judge instructions\n${prompt}`
        : `- AI judge instructions: built in "Best Use of Convex" prompt`,
    );
  }

  // Custom submission questions (answers live in each dossier)
  const questions = (group.submissionCustomQuestions ?? []).filter((q) => q.visible !== false);
  if (questions.length > 0) {
    lines.push("", "## Custom submission questions");
    for (const q of questions) {
      const options = q.options?.length ? ` Options: ${q.options.join(", ")}.` : "";
      lines.push(
        `- ${q.label} (${q.fieldType}, ${q.required ? "required" : "optional"})${q.description ? `: ${oneLine(q.description, 200)}` : ""}${options}`,
      );
    }
  }

  return lines.join("\n");
}

export function buildHumanLeaderboardDoc(
  snap: GroupSnapshot,
  limit = CAP_DIGEST_ROWS,
): string {
  const rows = snap.human.slice(0, limit);
  const lines = [
    "## Human judges leaderboard",
    "| Rank | Submission | Total | Avg | Scores | Completed |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.rank} | ${storyLink(r.title, r.slug)} (id ${r.storyId}) | ${round(r.totalScore)} | ${round(
        r.averageScore,
      )} | ${r.scoreCount} | ${r.completed ? "yes" : "no"} |`,
    );
  }
  if (snap.human.length > rows.length) {
    lines.push(`(${snap.human.length - rows.length} more not shown)`);
  }
  return lines.join("\n");
}

export function buildAiLeaderboardDoc(
  snap: GroupSnapshot,
  limit = CAP_DIGEST_ROWS,
): string {
  const rows = snap.ai.slice(0, limit);
  const lines = [
    "## AI judge leaderboard",
    "| Rank | Submission | Weighted | Avg | Why |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.rank} | ${storyLink(r.title, r.slug)} (id ${r.storyId}) | ${round(
        r.weightedScore,
      )} | ${round(r.averageScore)} | ${r.summary.replace(/\|/g, "/")} |`,
    );
  }
  if (snap.ai.length > rows.length) {
    lines.push(`(${snap.ai.length - rows.length} more not shown)`);
  }
  if (rows.length === 0) lines.push("No completed AI reviews yet.");
  return lines.join("\n");
}

// Side by side ranks with a normalized score per source and the rank gap,
// so "where do humans and the AI disagree" is a lookup, not a computation.
export function buildCombinedLeaderboardDoc(
  snap: GroupSnapshot,
  limit = CAP_DIGEST_ROWS,
): string {
  const scale = snap.gc.group.scoreScale ?? 10;
  const humanById = new Map(snap.human.map((r) => [r.storyId, r]));
  const aiById = new Map(snap.ai.map((r) => [r.storyId, r]));
  const rows = snap.stories.map((story) => {
    const h = humanById.get(story._id);
    const a = aiById.get(story._id);
    const humanNorm =
      h && h.scoreCount > 0 ? (h.averageScore / scale) * 10 : undefined;
    const aiNorm = a?.averageScore;
    const blend =
      humanNorm !== undefined && aiNorm !== undefined
        ? (humanNorm + aiNorm) / 2
        : (humanNorm ?? aiNorm);
    return {
      story,
      humanRank: h && h.scoreCount > 0 ? h.rank : undefined,
      aiRank: a?.rank,
      humanNorm,
      aiNorm,
      blend,
    };
  });
  rows.sort((x, y) => (y.blend ?? -1) - (x.blend ?? -1));
  const lines = [
    "## Combined view (scores normalized to 10)",
    "| Submission | Human rank | AI rank | Rank gap | Human avg /10 | AI avg /10 | Blend |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const r of rows.slice(0, limit)) {
    const gap =
      r.humanRank !== undefined && r.aiRank !== undefined
        ? String(Math.abs(r.humanRank - r.aiRank))
        : "n/a";
    lines.push(
      `| ${storyLink(r.story.title, r.story.slug)} | ${r.humanRank ?? "n/a"} | ${
        r.aiRank ?? "n/a"
      } | ${gap} | ${round(r.humanNorm)} | ${round(r.aiNorm)} | ${round(r.blend)} |`,
    );
  }
  return lines.join("\n");
}

// Compact roster with ids and links so the model can cite and fetch any
// submission without a search round trip.
export function buildRosterDoc(
  snap: GroupSnapshot,
  limit = CAP_DIGEST_ROWS * 2,
): string {
  const lines = ["## Roster (id, page, live app, repo, video)"];
  for (const story of snap.stories.slice(0, limit)) {
    const parts = [
      `id ${story._id}`,
      storyLink(story.title, story.slug),
      story.url ? `app ${story.url}` : null,
      story.githubUrl ? `repo ${story.githubUrl}` : null,
      story.videoUrl ? `video ${story.videoUrl}` : null,
    ].filter(Boolean);
    lines.push(`- ${parts.join(" | ")}`);
  }
  if (snap.stories.length > limit) {
    lines.push(`(${snap.stories.length - limit} more; use search_submissions)`);
  }
  return lines.join("\n");
}
