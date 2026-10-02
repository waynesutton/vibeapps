import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { researchModelLabel } from "../../../../convex/lib/researchModels";

export type ResearchMessage = FunctionReturnType<
  typeof api.research.listMessages
>[number];

export type ResearchThread = FunctionReturnType<
  typeof api.research.listThreads
>[number];

export function slugify(text: string, max = 48): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
  return slug || "research";
}

// Trigger a browser download for Markdown text
export function downloadMarkdown(filename: string, markdown: string): void {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".md") ? filename : `${filename}.md`;
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function sourcesBlock(message: ResearchMessage): string {
  if (!message.sources || message.sources.length === 0) return "";
  const lines = message.sources.map((s) => `- [${s.title}](${s.url})`);
  return `\n\n## Sources\n\n${lines.join("\n")}`;
}

function metaLine(groupName: string, message: ResearchMessage): string {
  const when = new Date(message.completedAt ?? message._creationTime);
  return `_${groupName} research · ${researchModelLabel(message.model)} · ${when.toLocaleString()}_`;
}

// One answer as a standalone document, titled by the question that prompted it
export function answerToMarkdown(
  groupName: string,
  question: string | undefined,
  answer: ResearchMessage,
): string {
  const title = question?.trim() || "Research answer";
  return `# ${title}\n\n${metaLine(groupName, answer)}\n\n${answer.content.trim()}${sourcesBlock(answer)}\n`;
}

// Whole thread as a transcript
export function threadToMarkdown(
  groupName: string,
  title: string,
  messages: Array<ResearchMessage>,
): string {
  const parts = [`# ${title}`, `_${groupName} research thread_`];
  for (const message of messages) {
    if (message.role === "user") {
      parts.push(
        `## ${message.authorName ?? "Question"}\n\n${message.content.trim()}`,
      );
    } else if (message.content.trim()) {
      parts.push(
        `## Answer (${researchModelLabel(message.model)})\n\n${message.content.trim()}${sourcesBlock(message)}`,
      );
    }
  }
  return `${parts.join("\n\n")}\n`;
}
