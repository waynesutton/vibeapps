import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowUp, Download, Square, Telescope } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { getConvexErrorMessage } from "../../../lib/convexErrors";
import { ResearchMessageView } from "./ResearchMessageView";
import {
  downloadMarkdown,
  researchMessageDomId,
  slugify,
  threadToMarkdown,
  type ResearchThread,
} from "./researchExport";

// Starter questions for an empty thread
const STARTERS = [
  "Compare the top 10 submissions side by side",
  "List the human judges' top 10 with scores",
  "List the AI judge's top 10 and why each ranked there",
  "Pick a top 3 and an overall winner with reasons",
  "Where do the human and AI rankings disagree most?",
  "Which submissions have the strongest repos and live apps?",
];

export function ResearchChat({
  groupId,
  groupName,
  groupSlug,
  thread,
  ready,
  focusMessageId,
  onFocusMissing,
  onThreadCreated,
}: {
  groupId: Id<"judgingGroups">;
  groupName: string;
  groupSlug: string;
  thread: ResearchThread | null;
  ready: boolean;
  focusMessageId: string | null;
  onFocusMissing: () => void;
  onThreadCreated: (threadId: Id<"researchThreads">) => void;
}) {
  const messages = useQuery(
    api.research.listMessages,
    thread ? { threadId: thread._id } : "skip",
  );
  const sendMessage = useMutation(api.research.sendMessage);
  const stopMessage = useMutation(api.research.stopMessage);
  const retryMessage = useMutation(api.research.retryMessage);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const list = thread ? (messages ?? []) : [];
  const last = list.length > 0 ? list[list.length - 1] : undefined;
  const activeAnswer =
    last &&
    last.role === "assistant" &&
    (last.status === "pending" || last.status === "streaming")
      ? last
      : undefined;
  const busy = sending || activeAnswer !== undefined;

  // Follow the streaming answer unless the reader scrolled up
  const lastContentLength = last?.content.length ?? 0;
  const lastStepCount = last?.toolSteps?.length ?? 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [list.length, lastContentLength, lastStepCount]);

  // Shared answer link: scroll to the question above the answer so context
  // reads first, pause auto follow, and briefly outline the answer. Runs once
  // per linked id, after the bottom scroll above on first load.
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const focusedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!focusMessageId || messages === undefined) return;
    if (focusedRef.current === focusMessageId) return;
    focusedRef.current = focusMessageId;
    const index = messages.findIndex((m) => m._id === focusMessageId);
    if (index === -1) {
      toast.error("That answer is no longer in this thread.");
      onFocusMissing();
      return;
    }
    const prev = index > 0 ? messages[index - 1] : undefined;
    const target = prev?.role === "user" ? prev._id : focusMessageId;
    stickToBottom.current = false;
    document
      .getElementById(researchMessageDomId(target))
      ?.scrollIntoView({ block: "start" });
    setHighlightId(focusMessageId);
  }, [focusMessageId, messages, onFocusMissing]);

  useEffect(() => {
    if (!highlightId) return;
    const timer = window.setTimeout(() => setHighlightId(null), 2400);
    return () => window.clearTimeout(timer);
  }, [highlightId]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy || !ready) return;
    setSending(true);
    stickToBottom.current = true;
    try {
      const result = await sendMessage({
        groupId,
        threadId: thread?._id,
        content,
      });
      setDraft("");
      if (!thread) onThreadCreated(result.threadId);
    } catch (error) {
      toast.error(getConvexErrorMessage(error, "Could not send the question"));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send(draft);
    }
  };

  const handleStop = async () => {
    if (!activeAnswer) return;
    try {
      await stopMessage({ messageId: activeAnswer._id });
    } catch (error) {
      toast.error(getConvexErrorMessage(error, "Could not stop the answer"));
    }
  };

  const handleRetry = async (messageId: Id<"researchMessages">) => {
    stickToBottom.current = true;
    try {
      await retryMessage({ messageId });
    } catch (error) {
      toast.error(getConvexErrorMessage(error, "Could not retry"));
    }
  };

  const handleExportThread = () => {
    if (!thread || list.length === 0) return;
    downloadMarkdown(
      `${groupSlug}-${slugify(thread.title)}.md`,
      threadToMarkdown(groupName, thread.title, list),
    );
  };

  return (
    <div className="flex flex-col min-h-0 h-full">
      {/* Thread header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-hairline">
        <p className="text-[13px] font-medium text-ink truncate">
          {thread ? thread.title : "New research thread"}
        </p>
        {thread && list.length > 0 && (
          <button
            type="button"
            onClick={handleExportThread}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] text-soft hover:text-ink hover:bg-surface-hover transition-colors flex-shrink-0"
            title="Download the whole thread as Markdown"
          >
            <Download className="w-3.5 h-3.5" />
            Thread .md
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4"
      >
        {thread && messages === undefined ? (
          <p className="text-[13px] text-soft">Loading thread...</p>
        ) : list.length === 0 ? (
          <EmptyState
            groupName={groupName}
            ready={ready}
            onPick={(text) => void send(text)}
          />
        ) : (
          <div className="space-y-5 max-w-3xl mx-auto">
            {list.map((message, index) => {
              const prev = index > 0 ? list[index - 1] : undefined;
              return (
                <div
                  key={message._id}
                  id={researchMessageDomId(message._id)}
                  className="scroll-mt-4"
                >
                  <ResearchMessageView
                    message={message}
                    question={prev?.role === "user" ? prev.content : undefined}
                    groupName={groupName}
                    groupSlug={groupSlug}
                    threadId={thread?._id}
                    highlighted={highlightId === message._id}
                    canRetry={
                      ready &&
                      message.role === "assistant" &&
                      message._id === last?._id &&
                      !sending
                    }
                    onRetry={() => void handleRetry(message._id)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-hairline px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-end gap-2 rounded-lg border border-hairline bg-surface focus-within:border-hairline-strong transition-colors px-3 py-2">
          <label htmlFor="research-composer" className="sr-only">
            Ask about this group
          </label>
          <textarea
            id="research-composer"
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={8000}
            disabled={!ready}
            placeholder={
              ready
                ? "Ask about submissions, scores, or winners..."
                : "Research is indexing. Hang tight..."
            }
            className="flex-1 resize-none bg-transparent text-[13px] text-ink placeholder:text-faint focus:outline-none max-h-40 min-h-[24px] py-1 disabled:opacity-60 [field-sizing:content]"
          />
          {activeAnswer ? (
            <button
              type="button"
              onClick={() => void handleStop()}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-ink text-surface hover:opacity-90 transition-opacity flex-shrink-0"
              aria-label="Stop the answer"
              title="Stop"
            >
              <Square className="w-3.5 h-3.5" fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void send(draft)}
              disabled={!ready || busy || !draft.trim()}
              className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-ink text-surface hover:opacity-90 transition-opacity disabled:opacity-30 flex-shrink-0"
              aria-label="Send question"
              title="Send"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="max-w-3xl mx-auto text-[11px] text-faint mt-1.5">
          Enter to send, Shift + Enter for a new line. Threads are shared with
          admins who can see this group's results.
        </p>
      </div>
    </div>
  );
}

function EmptyState({
  groupName,
  ready,
  onPick,
}: {
  groupName: string;
  ready: boolean;
  onPick: (text: string) => void;
}) {
  return (
    <div className="max-w-2xl mx-auto py-8 text-center">
      <Telescope className="w-6 h-6 text-faint mx-auto" />
      <h3 className="text-sm font-semibold text-ink mt-3">
        Research {groupName}
      </h3>
      <p className="text-[13px] text-soft mt-1">
        Ask about any submission, the human scores, the AI judge reasoning, or
        the web. Answers cite submissions and sources.
      </p>
      <div className="grid sm:grid-cols-2 gap-2 mt-6 text-left">
        {STARTERS.map((starter) => (
          <button
            key={starter}
            type="button"
            disabled={!ready}
            onClick={() => onPick(starter)}
            className="px-3 py-2.5 rounded-md border border-hairline bg-surface text-[13px] text-copy hover:text-ink hover:bg-surface-hover transition-colors disabled:opacity-50 text-left"
          >
            {starter}
          </button>
        ))}
      </div>
    </div>
  );
}
