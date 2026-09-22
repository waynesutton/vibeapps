// Shared LLM caller for the AI judge and the spam check. Requests go to the
// hosted Convex AI gateway, which authenticates with the deployment's own
// service token, so this deployment holds no provider API keys.
//
// Model ids are gateway ids in "<provider>/<model>" form.

import { convexGateway } from "@convex-dev/ai-sdk-provider";
import { generateText } from "ai";

export type LlmResult = {
  text: string;
  provider: string;
  model: string;
};

export const DEFAULT_LLM_MODEL = "anthropic/claude-sonnet-4.5";

// Records written before the gateway migration store a bare provider name,
// so splitting the id prefix keeps new rows using the same vocabulary.
function providerOf(modelId: string): string {
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
  const model = DEFAULT_LLM_MODEL;
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
