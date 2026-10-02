import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Loader2,
  RotateCcw,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Markdown } from "../../Markdown";
import { researchModelLabel } from "../../../../convex/lib/researchModels";
import {
  answerToMarkdown,
  downloadMarkdown,
  slugify,
  type ResearchMessage,
} from "./researchExport";

// One chat turn. Questions render as a right aligned bubble; answers render
// as Markdown with live tool steps, sources, and copy / download / retry.
export function ResearchMessageView({
  message,
  question,
  groupName,
  groupSlug,
  canRetry,
  onRetry,
}: {
  message: ResearchMessage;
  question?: string;
  groupName: string;
  groupSlug: string;
  canRetry: boolean;
  onRetry: () => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-surface-alt border border-hairline px-3.5 py-2.5">
          <p className="text-[13px] text-ink whitespace-pre-wrap break-words">
            {message.content}
          </p>
          {message.authorName && (
            <p className="text-[11px] text-faint mt-1 text-right">
              {message.authorName}
            </p>
          )}
        </div>
      </div>
    );
  }

  const active = message.status === "pending" || message.status === "streaming";
  const hasText = message.content.trim().length > 0;

  return (
    <div className="space-y-2" aria-live={active ? "polite" : undefined}>
      <ToolSteps steps={message.toolSteps ?? []} active={active} />

      {hasText ? (
        <div className="prose prose-sm max-w-none text-copy prose-headings:text-ink prose-a:text-ink prose-strong:text-ink prose-table:text-[13px] prose-th:text-ink break-words">
          <Markdown>{message.content}</Markdown>
          {active && (
            <span
              className="inline-block w-1.5 h-4 align-text-bottom bg-ink opacity-60 animate-pulse ml-0.5"
              aria-hidden="true"
            />
          )}
        </div>
      ) : active ? (
        <p className="flex items-center gap-2 text-[13px] text-soft">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Thinking...
        </p>
      ) : null}

      {message.status === "failed" && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{message.error ?? "The answer failed. Try again."}</span>
        </div>
      )}
      {message.status === "stopped" && (
        <p className="text-[12px] text-faint">Stopped before finishing.</p>
      )}

      <Sources sources={message.sources ?? []} />

      {!active && (
        <AnswerActions
          message={message}
          question={question}
          groupName={groupName}
          groupSlug={groupSlug}
          canRetry={canRetry}
          onRetry={onRetry}
        />
      )}
    </div>
  );
}

function ToolSteps({
  steps,
  active,
}: {
  steps: NonNullable<ResearchMessage["toolSteps"]>;
  active: boolean;
}) {
  if (steps.length === 0) return null;

  const list = (
    <ul className="space-y-1 mt-1.5">
      {steps.map((step) => (
        <li
          key={step.id}
          className="flex items-center gap-2 text-[12px] text-soft"
        >
          {step.status === "running" ? (
            <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />
          ) : step.status === "done" ? (
            <Check className="w-3 h-3 text-green-600 flex-shrink-0" />
          ) : (
            <X className="w-3 h-3 text-red-500 flex-shrink-0" />
          )}
          <span className="truncate">{step.label}</span>
        </li>
      ))}
    </ul>
  );

  // Live steps stay open while the answer streams, then fold away
  if (active) {
    return (
      <div className="rounded-md border border-hairline bg-surface-alt px-3 py-2">
        <p className="flex items-center gap-1.5 text-[12px] font-medium text-copy">
          <Wrench className="w-3 h-3" />
          Researching
        </p>
        {list}
      </div>
    );
  }
  return (
    <details className="group text-[12px]">
      <summary className="cursor-pointer select-none text-faint hover:text-copy inline-flex items-center gap-1.5">
        <Wrench className="w-3 h-3" />
        Used {steps.length} tool{steps.length === 1 ? "" : "s"}
      </summary>
      {list}
    </details>
  );
}

function Sources({
  sources,
}: {
  sources: NonNullable<ResearchMessage["sources"]>;
}) {
  if (sources.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {sources.map((source) => (
        <a
          key={source.url}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          title={source.url}
          className="inline-flex items-center gap-1 max-w-[240px] px-2 py-0.5 rounded-full border border-hairline bg-surface text-[11px] text-copy hover:text-ink hover:bg-surface-hover transition-colors"
        >
          <Globe className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{source.title}</span>
          <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 text-faint" />
        </a>
      ))}
    </div>
  );
}

function AnswerActions({
  message,
  question,
  groupName,
  groupSlug,
  canRetry,
  onRetry,
}: {
  message: ResearchMessage;
  question?: string;
  groupName: string;
  groupSlug: string;
  canRetry: boolean;
  onRetry: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const hasText = message.content.trim().length > 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy to the clipboard");
    }
  };

  const handleDownload = () => {
    downloadMarkdown(
      `${groupSlug}-${slugify(question ?? "answer")}.md`,
      answerToMarkdown(groupName, question, message),
    );
  };

  const buttonClass =
    "inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-[12px] text-faint hover:text-ink hover:bg-surface-hover transition-colors";

  return (
    <div className="flex items-center gap-0.5 -ml-1.5">
      {hasText && (
        <>
          <button
            type="button"
            onClick={() => void handleCopy()}
            className={buttonClass}
            aria-label="Copy answer as Markdown"
            title="Copy as Markdown"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className={buttonClass}
            aria-label="Download answer as Markdown"
            title="Download .md"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </>
      )}
      {canRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={buttonClass}
          aria-label="Retry this answer"
          title="Retry"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      )}
      <span className="text-[11px] text-faint ml-1.5">
        {researchModelLabel(message.model)}
      </span>
    </div>
  );
}
