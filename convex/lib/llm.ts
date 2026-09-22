// Shared LLM callers for the AI judge and the spam check. Requests go to the
// hosted Convex AI gateway, which authenticates with the deployment's own
// service token, so this deployment holds no provider API keys.
//
// Two doors into the gateway:
//   - callLlm: chat models (Claude, GPT, ...) via generateText. Model id comes
//     from the AI_JUDGE_MODEL env var with a Claude Fable 5 fallback.
//   - evaluateRubric / classifySpam: Jev, TypeSafe's decisions model, via the
//     AI SDK's experimental evaluate. Jev returns typed answers with
//     probabilities and no prose, so it is used for calibrated scores and
//     verdicts, never for written reasoning.
//
// Model ids are gateway ids in "<provider>/<model>" form.

import { convexGateway } from "@convex-dev/ai-sdk-provider";
import {
  generateText,
  experimental_evaluate as evaluate,
  type Experimental_EvaluationModel as EvaluationModel,
} from "ai";
import { env } from "../_generated/server";

export type LlmResult = {
  text: string;
  provider: string;
  model: string;
};

// Used when AI_JUDGE_MODEL is unset. Any id from the gateway model list works:
// https://docs.convex.dev/ai-gateway/models
export const FALLBACK_LLM_MODEL = "anthropic/claude-fable-5";

// Jev is served from the gateway's decisions endpoint (alpha) and is not
// listed by GET /v1/models. It only answers choice, score, and boolean
// questions and cannot take images.
export const JEV_MODEL = "typesafe/jev-1.13";

// Runtime read so admins can switch models from the Convex dashboard without
// a redeploy. Declared as typed app env in convex.config.ts.
export function resolveLlmModel(): string {
  const configured = env.AI_JUDGE_MODEL?.trim();
  return configured ? configured : FALLBACK_LLM_MODEL;
}

// Records written before the gateway migration store a bare provider name,
// so splitting the id prefix keeps new rows using the same vocabulary.
export function providerOf(modelId: string): string {
  const slash = modelId.indexOf("/");
  return slash === -1 ? modelId : modelId.slice(0, slash);
}

export async function callLlm(
  systemPrompt: string,
  userMessage: string,
  opts: {
    maxOutputTokens: number;
    temperature: number;
    // Optional image (e.g. a live app screenshot) attached to the user turn.
    // Callers should retry without it if the multimodal request fails.
    imageUrl?: string;
  },
): Promise<LlmResult> {
  const model = resolveLlmModel();
  const shared = {
    model: convexGateway(model),
    system: systemPrompt,
    temperature: opts.temperature,
    maxOutputTokens: opts.maxOutputTokens,
  };
  // With an image the user turn becomes a multipart message (text + image);
  // without one the plain prompt path is unchanged.
  const { text } = opts.imageUrl
    ? await generateText({
        ...shared,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: userMessage },
              // Top-level "image" media type lets the provider detect the
              // exact subtype from the fetched bytes
              {
                type: "file",
                data: { type: "url", url: new URL(opts.imageUrl) },
                mediaType: "image",
              },
            ],
          },
        ],
      })
    : await generateText({ ...shared, prompt: userMessage });
  if (!text) throw new Error(`Empty response from ${model}`);
  return { text, provider: providerOf(model), model };
}

// --- Jev: structured decisions ---

// The provider's esm typings leave evaluationModel untyped, so pin the type
// here once instead of letting `any` leak into callers.
function jevModel(): EvaluationModel {
  const model: EvaluationModel = convexGateway.evaluationModel(JEV_MODEL);
  return model;
}

// Highest probability in a distribution: how concentrated the answer is.
// Undefined when the provider returned no distribution.
function peakProbability(
  probabilities: Record<string, number> | undefined,
): number | undefined {
  if (!probabilities) return undefined;
  let peak: number | undefined;
  for (const value of Object.values(probabilities)) {
    if (peak === undefined || value > peak) peak = value;
  }
  return peak === undefined ? undefined : Math.round(peak * 100) / 100;
}

export type RubricScore = {
  key: string;
  // 1 to 10, one decimal, mapped from Jev's fractional level position
  score: number;
  // 0 to 1 peak probability across the rubric levels, when available
  confidence?: number;
};

export type RubricEvaluation = {
  model: string;
  scores: Array<RubricScore>;
};

// Five ordered anchors per criterion. Jev returns a fractional zero based
// position across them (a probability weighted mean), which maps linearly
// onto the judge's 1 to 10 scale. Fewer, sharper anchors calibrate better
// than ten near identical ones.
function rubricLevels(label: string): Array<string> {
  return [
    `Absent or broken: no real evidence of ${label}, or the evidence contradicts the claim.`,
    `Weak: minimal or superficial ${label}; mostly boilerplate or a token attempt.`,
    `Adequate: working, ordinary ${label} that meets the basic bar without depth.`,
    `Strong: thoughtful, well integrated ${label} that clearly goes beyond the basics.`,
    `Exceptional: outstanding ${label}, the kind a senior reviewer would point to as a model example.`,
  ];
}

const RUBRIC_LEVEL_COUNT = 5;

/**
 * Score every rubric criterion with Jev from text only context. Question ids
 * are positional (q0, q1, ...) so rubric keys of any shape are safe, then
 * mapped back to their keys in the result.
 */
export async function evaluateRubric(
  state: string,
  rubric: Array<{ key: string; label: string; description: string }>,
): Promise<RubricEvaluation> {
  if (rubric.length === 0) return { model: JEV_MODEL, scores: [] };

  const questions: Record<
    string,
    {
      type: "score";
      instructions: string;
      criteria: Array<string>;
    }
  > = {};
  rubric.forEach((criterion, index) => {
    questions[`q${index}`] = {
      type: "score",
      instructions: `Grade the submission on "${criterion.label}". ${criterion.description} Judge only from the evidence in the state; do not reward claims that the verified facts contradict.`,
      criteria: rubricLevels(criterion.label),
    };
  });

  const result = await evaluate({ model: jevModel(), state, questions });

  const scale = 9 / (RUBRIC_LEVEL_COUNT - 1);
  const scores: Array<RubricScore> = rubric.map((criterion, index) => {
    const answer = result.answers[`q${index}`];
    if (!answer || answer.type !== "score") {
      throw new Error(`Jev returned no score for ${criterion.key}`);
    }
    const position = Math.min(
      Math.max(answer.score, 0),
      RUBRIC_LEVEL_COUNT - 1,
    );
    const score = Math.round((1 + position * scale) * 10) / 10;
    const confidence = peakProbability(answer.probabilities);
    return confidence === undefined
      ? { key: criterion.key, score }
      : { key: criterion.key, score, confidence };
  });

  return { model: JEV_MODEL, scores };
}

export type SpamVerdict = "spam" | "suspicious" | "clean";

export type SpamClassification = {
  model: string;
  verdict: SpamVerdict;
  // 0 to 100, the probability Jev assigned to the chosen verdict
  confidence: number;
  probabilities: Record<SpamVerdict, number>;
  // Short reason strings for flags whose probability cleared the threshold
  reasons: Array<string>;
};

// Boolean flags Jev evaluates alongside the verdict. Each maps to the short
// reason shown in the Spam tab (and possibly to the submitter), so keep the
// wording specific and non accusatory.
const SPAM_FLAGS: Array<{ id: string; instructions: string; reason: string }> =
  [
    {
      id: "deadOrPlaceholderUrl",
      instructions:
        "The submitted live app URL is dead, parked, a placeholder, or not the app described.",
      reason: "Live URL is dead, a placeholder, or not the described app",
    },
    {
      id: "emptyOrMissingRepo",
      instructions:
        "The linked repository is empty, inaccessible, or unrelated to the submission.",
      reason: "Repository is empty, inaccessible, or unrelated",
    },
    {
      id: "descriptionIsGibberishOrTemplate",
      instructions:
        "The title or description is gibberish, keyword stuffing, or unedited template text.",
      reason: "Description is gibberish, keyword stuffing, or template text",
    },
    {
      id: "promotionalOrUnrelatedContent",
      instructions:
        "The content promotes an unrelated product, service, or scheme instead of describing a built app.",
      reason: "Promotes an unrelated product, service, or scheme",
    },
    {
      id: "linksPointElsewhere",
      instructions:
        "The video or social links point to unrelated or deceptive destinations. Bot protection responses (403/429) alone do not count.",
      reason: "Video or social links point somewhere unrelated",
    },
  ];

// A flag becomes a reason only when Jev is fairly sure it is true
const SPAM_FLAG_THRESHOLD = 0.7;

/**
 * Classify a submission with Jev: one choice question for the verdict plus
 * boolean flags that become the reasons list. `instructions` is the admin
 * editable spam prompt so the existing editor keeps steering the verdict;
 * `state` is the same signals-plus-content message the chat model receives.
 */
export async function classifySpam(
  instructions: string,
  state: string,
): Promise<SpamClassification> {
  // One record holds the verdict question and the boolean flags; the union
  // type keeps answers narrowable by `type` below.
  type SpamQuestion =
    | {
        type: "choice";
        instructions: string;
        criteria: Record<SpamVerdict, string>;
      }
    | { type: "boolean"; instructions: string };
  const questions: Record<string, SpamQuestion> = {
    verdict: {
      type: "choice",
      instructions,
      criteria: {
        spam: "Strong evidence of deception or irrelevance: dead or parked URL passed off as an app, link farm, SEO or affiliate content, unrelated promos, empty repo sold as a product.",
        suspicious:
          "Something is off and a human should look, but the evidence is not strong enough to call it spam.",
        clean:
          "A real app, even if rough, unfinished, or unimpressive. Quality is never a reason to flag.",
      },
    },
  };
  for (const flag of SPAM_FLAGS) {
    questions[flag.id] = { type: "boolean", instructions: flag.instructions };
  }

  const result = await evaluate({ model: jevModel(), state, questions });

  const verdictAnswer = result.answers.verdict;
  if (!verdictAnswer || verdictAnswer.type !== "choice") {
    throw new Error("Jev returned no verdict");
  }
  const verdict: SpamVerdict =
    verdictAnswer.choice === "spam" || verdictAnswer.choice === "suspicious"
      ? verdictAnswer.choice
      : "clean";
  const raw = verdictAnswer.probabilities;
  const probabilities: Record<SpamVerdict, number> = {
    spam: Math.round((raw?.spam ?? 0) * 100) / 100,
    suspicious: Math.round((raw?.suspicious ?? 0) * 100) / 100,
    clean: Math.round((raw?.clean ?? 0) * 100) / 100,
  };
  // Without a distribution the choice alone is not calibrated, so report
  // middling confidence rather than pretend certainty (keeps auto mark off).
  const confidence = raw ? Math.round((raw[verdict] ?? 0) * 100) : 50;

  const reasons: Array<string> = [];
  for (const flag of SPAM_FLAGS) {
    const answer = result.answers[flag.id];
    if (
      answer &&
      answer.type === "boolean" &&
      answer.probability >= SPAM_FLAG_THRESHOLD
    ) {
      reasons.push(flag.reason);
    }
  }

  return { model: JEV_MODEL, verdict, confidence, probabilities, reasons };
}
