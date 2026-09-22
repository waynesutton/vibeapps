// Shared content for the public How to judge page and its Markdown export.
// Everything here is pure: the page renders these strings as JSX and the
// admin section joins them into one Markdown document for Google Docs, so
// the two never drift. Data comes from api.judgingGroups.getHowToJudgePage.

import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";
import { formatDeadline } from "./countdown";

export type HowToJudgeData = NonNullable<
  FunctionReturnType<typeof api.judgingGroups.getHowToJudgePage>
>;

export type HowToJudgeLink = {
  label: string;
  url: string;
  note?: string;
  kind: "judge" | "results" | "ai" | "tag" | "custom" | "guide";
};

// Literal placeholder shown where the access code would go. The organizer
// sends the real code by Slack or email; the page never stores or shows it.
export const ACCESS_CODE_PLACEHOLDER = "passcodegoeshere";

export function accessCodeNote(data: HowToJudgeData): string {
  const note = data.howToJudge?.accessCodeNote?.trim();
  return note && note.length > 0 ? note : ACCESS_CODE_PLACEHOLDER;
}

export function judgingUrl(data: HowToJudgeData, origin: string): string {
  return `${origin}/judging/${data.slug}`;
}

export function guideUrl(data: HowToJudgeData, origin: string): string {
  return `${origin}/judging/${data.slug}/howtojudge`;
}

// Whether a link to the human results page should appear. Shareable means
// the page is public or has its own passcode; the organizer can also hide it.
export function showResultsLink(data: HowToJudgeData): boolean {
  if (data.howToJudge?.showResultsLink === false) return false;
  return data.resultsIsPublic || data.hasResultsPassword;
}

export function showAiResultsLink(data: HowToJudgeData): boolean {
  return (
    data.aiJudgeEnabled && (data.aiResultsIsPublic || data.hasAiResultsPassword)
  );
}

// Every link a judge might need, in the order they appear on the page
export function judgingLinks(
  data: HowToJudgeData,
  origin: string,
): Array<HowToJudgeLink> {
  const links: Array<HowToJudgeLink> = [
    {
      kind: "judge",
      label: "Judging link",
      url: judgingUrl(data, origin),
      note: data.hasJudgePassword
        ? "Enter the access code, then your first name."
        : "Enter your first name to start.",
    },
  ];
  if (showResultsLink(data)) {
    links.push({
      kind: "results",
      label: "Results",
      url: `${origin}/judging/${data.slug}/results`,
      note: data.resultsIsPublic
        ? "Live rankings from human judges."
        : "Live rankings from human judges. Needs the results passcode.",
    });
  }
  if (showAiResultsLink(data)) {
    links.push({
      kind: "ai",
      label: "AI results",
      url: `${origin}/judging/${data.slug}/ai-results`,
      note: data.aiResultsIsPublic
        ? "Advisory AI review of every submission."
        : "Advisory AI review of every submission. Needs the AI results passcode.",
    });
  }
  for (const tag of data.tags) {
    links.push({
      kind: "tag",
      label: `${tag.name} submissions`,
      url: `${origin}/tag/${tag.slug}`,
      note: "Public listing of every app tagged for this event.",
    });
  }
  for (const link of data.howToJudge?.links ?? []) {
    if (!link.url.trim()) continue;
    links.push({
      kind: "custom",
      label: link.label.trim() || link.url,
      url: link.url.trim(),
    });
  }
  return links;
}

// Judging deadline in the viewer's time zone, or null when the organizer
// has not set one. The AI event window end is not used: that is when
// building stops, not when judging closes.
export function deadlineText(data: HowToJudgeData): string | null {
  const at = data.howToJudge?.deadlineAt;
  return typeof at === "number" ? formatDeadline(at) : null;
}

// The five step summary at the top of the page. Plain sentences so the
// Markdown export can number them and the page can render them as a list.
export function tldrSteps(data: HowToJudgeData, origin: string): Array<string> {
  const steps: Array<string> = [];
  steps.push(`Open the judging link: ${judgingUrl(data, origin)}`);
  if (data.hasJudgePassword) {
    steps.push(
      `Enter the access code ${accessCodeNote(data)} (your organizer sends the real code by Slack or email).`,
    );
  }
  steps.push(
    "Type your first name in lowercase letters and use the same name every time you come back.",
  );
  const count =
    data.judgeQueueMode === "shortlist"
      ? data.shortlistCount
      : data.submissionCount;
  steps.push(
    `Score every criterion (1 to ${data.scoreScale}) for each of the ${count} submission${count === 1 ? "" : "s"}, then press Mark Complete or Judged & Next.`,
  );
  const deadline = deadlineText(data);
  steps.push(
    deadline
      ? `Finish by ${deadline}. Scores save as you go, so you can leave and return.`
      : "Finish before the organizer closes judging. Scores save as you go, so you can leave and return.",
  );
  return steps;
}

// One paragraph on what the judge will see in their queue
export function queueSummary(data: HowToJudgeData): string {
  const multi =
    data.judgesPerSubmission > 1
      ? ` Each submission needs ${data.judgesPerSubmission} judges. Once that many have marked it complete it locks for everyone else, so the queue shrinks as the group works.`
      : " Once you mark a submission complete it locks for you, and you can reopen it with Edit Scores.";
  if (data.judgeQueueMode === "shortlist") {
    const ai = data.aiJudgeEnabled
      ? `The AI judge reviewed all ${data.submissionCount} submissions first. `
      : "";
    // Only promise an AI rank when the AI judge actually ran
    const belowCut = data.showBelowCutToJudges
      ? ` The other ${Math.max(0, data.submissionCount - data.shortlistCount)} stay visible below the cut, grayed out${data.aiJudgeEnabled ? " with their AI rank and score" : ""}. You can read them and leave notes, but scoring is off.`
      : "";
    return `${ai}Organizers shortlisted ${data.shortlistCount} for human judges, and your queue shows only those ${data.shortlistCount}.${belowCut}${multi}`;
  }
  return `Your queue shows every one of the ${data.submissionCount} submissions in this group.${multi}`;
}

export function scaleSummary(data: HowToJudgeData): string {
  return `Every criterion is scored from 1 to ${data.scoreScale}. Higher is better. Comments are optional but help organizers understand the number.`;
}

// Rating anchors adapted to the group's scale
export function ratingAnchors(
  scale: number,
): Array<{ range: string; meaning: string }> {
  if (scale === 5) {
    return [
      { range: "1", meaning: "Missing or broken" },
      { range: "2", meaning: "Attempted but weak" },
      { range: "3", meaning: "Solid, meets the bar" },
      { range: "4", meaning: "Strong, clearly above average" },
      { range: "5", meaning: "Exceptional, best in the group" },
    ];
  }
  return [
    { range: "1 to 3", meaning: "Missing, broken, or barely attempted" },
    { range: "4 to 6", meaning: "Works but ordinary, gaps remain" },
    { range: "7 to 8", meaning: "Strong, polished, clearly above average" },
    { range: "9 to 10", meaning: "Exceptional, best in the group" },
  ];
}

// How judges should treat the AI review. Empty when the AI judge is off so
// groups without it never mention it.
export function aiReviewParagraphs(
  data: HowToJudgeData,
  origin: string,
): Array<string> {
  if (!data.aiJudgeEnabled) return [];
  const paragraphs: Array<string> = [];
  paragraphs.push(
    "This event also runs an AI judge. It opens the live app, reads the public repository, watches the demo video transcript, checks social links, and scores each submission 1 to 10 on its own rubric. It is advisory: it never changes your scores and organizers use it to catch broken links, spot spam, and get a second read.",
  );
  if (data.aiRubricLabels.length > 0) {
    paragraphs.push(`AI rubric: ${data.aiRubricLabels.join(", ")}.`);
  }
  if (data.judgeQueueMode === "shortlist") {
    paragraphs.push(
      data.showBelowCutToJudges
        ? "The AI reviewed every submission first. Organizers used those results to build the shortlist you are judging. Submissions below the cut stay visible read only with their AI rank and the AI review, so you can see why they missed. If one deserves a second look, say so in a note and the organizer can add it to the shortlist."
        : "The AI reviewed every submission first. Organizers used those results to build the shortlist you are judging, so every app in your queue already passed that pass.",
    );
  }
  const seen: Array<string> = [];
  if (data.aiReviewVisibleToJudges) {
    seen.push(
      "a collapsed AI review card on each submission with the per criterion score and reasoning",
    );
  }
  if (showAiResultsLink(data)) {
    seen.push(`the AI results page at ${origin}/judging/${data.slug}/ai-results`);
  }
  if (seen.length > 0) {
    paragraphs.push(
      `Where you see it: ${seen.join(", and ")}. Score independently first, then open the AI review to compare notes. If you disagree with the AI, trust your own read and say why in the comments.`,
    );
  } else {
    paragraphs.push(
      "Judges do not see the AI scores during this event. Organizers review them separately.",
    );
  }
  return paragraphs;
}

export const TROUBLESHOOTING: Array<{ problem: string; fix: string }> = [
  {
    problem: "The access code is rejected",
    fix: "Codes are case sensitive. Paste it with no spaces. If it still fails, message your organizer.",
  },
  {
    problem: "My earlier scores are gone",
    fix: "Enter the exact same lowercase first name you used before. A different spelling creates a new judge.",
  },
  {
    problem: "A submission is locked",
    fix: "Enough judges already completed it, or you marked it complete. Use Edit Scores if the button is shown.",
  },
  {
    problem: "The live app link is down",
    fix: "Score what you can from the video, screenshots, and repository, then leave a comment saying the link failed.",
  },
  {
    problem: "The page says judging is paused",
    fix: "The organizer closed the window. You can still read this guide, and scores you already saved are kept.",
  },
];

function mdLink(label: string, url: string): string {
  return `[${label}](${url})`;
}

function linksBlock(links: Array<HowToJudgeLink>): string {
  return links
    .map((l) => `- ${mdLink(l.label, l.url)}${l.note ? `: ${l.note}` : ""}`)
    .join("\n");
}

/**
 * The whole page as Markdown. Headings, lists, and links paste cleanly into
 * Google Docs. Mirrors the page section order so a judge who read one can
 * follow the other.
 */
export function buildHowToJudgeMarkdown(
  data: HowToJudgeData,
  origin: string,
): string {
  const links = judgingLinks(data, origin);
  const deadline = deadlineText(data);
  const settings = data.howToJudge;
  const out: Array<string> = [];

  out.push(`# How to judge: ${data.name}`);
  if (data.description?.trim()) out.push(data.description.trim());
  out.push(
    `Live version of this guide: ${guideUrl(data, origin)}${data.isActive ? "" : "\n\nJudging is currently paused for this group."}`,
  );
  if (deadline) out.push(`Judging deadline: ${deadline}`);

  out.push("## Links", linksBlock(links));

  out.push(
    "## TL;DR",
    tldrSteps(data, origin)
      .map((step, i) => `${i + 1}. ${step}`)
      .join("\n"),
  );

  out.push(
    "## Getting in",
    [
      `1. Open ${mdLink("the judging link", judgingUrl(data, origin))}.`,
      data.hasJudgePassword
        ? `2. Enter the access code (${accessCodeNote(data)}). Your organizer sends the real code by Slack or email. Never post it publicly.`
        : "2. No access code is needed for this group.",
      "3. Type your first name. The field only accepts lowercase letters, and that name labels every score you give. Email is optional.",
      "4. Coming back later? Use the exact same name and your progress is waiting.",
    ].join("\n"),
  );

  out.push("## Your queue", queueSummary(data));

  const criteriaLines =
    data.criteria.length > 0
      ? data.criteria
          .map(
            (c, i) =>
              `${i + 1}. **${c.question}**${c.description?.trim() ? ` ${c.description.trim()}` : ""}`,
          )
          .join("\n")
      : "Criteria have not been published yet. Check the live guide before you start.";
  out.push(
    "## Scoring criteria",
    scaleSummary(data),
    criteriaLines,
    "Rating guide:",
    ratingAnchors(data.scoreScale)
      .map((a) => `- ${a.range}: ${a.meaning}`)
      .join("\n"),
  );

  out.push(
    "## Status and finishing",
    [
      "- **Pending**: not started or in progress. Scores save the moment you pick a number.",
      "- **Completed**: every criterion scored and you pressed Mark Complete or Judged & Next.",
      "- **Skip**: use when a submission is not eligible or you have a conflict of interest, and say why in a note.",
      "- **Edit Scores** reopens a completed submission when editing is still allowed.",
      data.judgesPerSubmission > 1
        ? `- Each submission needs ${data.judgesPerSubmission} judges. After that many completions it locks and shows who judged it.`
        : "- Judged & Next completes the current submission and loads the next unscored one.",
    ].join("\n"),
  );

  out.push(
    "## What each submission shows",
    [
      "- Live app link, GitHub repository, and demo video when the team provided them",
      "- Screenshot and any extra images",
      "- Description, tags, team name and members, and answers to any event questions",
      "- Social proof card with launch post engagement when the team shared LinkedIn, X, or Bluesky links",
      "- Notes: a thread per submission for you and the other judges, with @mentions",
    ].join("\n"),
  );

  const ai = aiReviewParagraphs(data, origin);
  if (ai.length > 0) out.push("## AI review", ...ai);

  out.push(
    "## Finding your way around",
    [
      "- Search by title, filter by tag, by judged status, or by judge.",
      "- The progress bar counts completed submissions against your queue.",
      "- Use the Completed Submissions list to jump back to anything you finished.",
    ].join("\n"),
  );

  out.push(
    "## Troubleshooting",
    "| Problem | Fix |\n| --- | --- |\n" +
      TROUBLESHOOTING.map((t) => `| ${t.problem} | ${t.fix} |`).join("\n"),
  );

  if (settings?.privateRepoNote?.trim())
    out.push("## Private repositories", settings.privateRepoNote.trim());
  if (settings?.assignments?.trim())
    out.push("## Judge assignments", settings.assignments.trim());
  if (settings?.notes?.trim()) out.push("## Notes from the organizer", settings.notes.trim());
  if (settings?.contact?.trim()) out.push("## Contact", settings.contact.trim());

  out.push("## Links", linksBlock(links));

  return out.join("\n\n") + "\n";
}
