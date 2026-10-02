// Curated Convex AI Gateway models offered in the judging research chat.
// Pure data so the admin UI can import the same list the server validates
// against. Every entry must support tool calling; ids come from
// https://docs.convex.dev/ai-gateway/models

export type ResearchModelOption = {
  id: string;
  label: string;
  note: string;
};

export const RESEARCH_MODELS: Array<ResearchModelOption> = [
  {
    id: "anthropic/claude-opus-5.5",
    label: "Claude Opus 5.5",
    note: "Deepest reasoning for winner picks",
  },
  {
    id: "anthropic/claude-sonnet-5.5",
    label: "Claude Sonnet 5.5",
    note: "Fast and sharp, good default",
  },
  {
    id: "anthropic/claude-fable-5.1",
    label: "Claude Fable 5.1",
    note: "Matches the AI judge family",
  },
  {
    id: "openai/gpt-6.1-sol",
    label: "GPT 6.1 Sol",
    note: "OpenAI flagship",
  },
  {
    id: "google/gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    note: "Quickest answers",
  },
  {
    id: "x-ai/grok-4.7",
    label: "Grok 4.7",
    note: "xAI flagship",
  },
];

export function isResearchModel(id: string): boolean {
  return RESEARCH_MODELS.some((model) => model.id === id);
}

export function researchModelLabel(id: string | undefined): string {
  if (!id) return "Default model";
  return RESEARCH_MODELS.find((model) => model.id === id)?.label ?? id;
}
