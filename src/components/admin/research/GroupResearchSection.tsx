import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  RESEARCH_MODELS,
  researchModelLabel,
} from "../../../../convex/lib/researchModels";
import { useDialog } from "../../../hooks/useDialog";
import { getConvexErrorMessage } from "../../../lib/convexErrors";
import { SimpleSelect } from "../../ui/SimpleSelect";
import { SectionCard, TogglePill, type GroupDetails } from "../judging/groupSection";
import { ResearchChat } from "./ResearchChat";
import { ResearchThreadList } from "./ResearchThreadList";

type ResearchStatus = NonNullable<
  FunctionReturnType<typeof api.research.getStatus>
>;

// Research chat for one judging group: enable toggle, indexing progress,
// model picker, then a shared thread list beside the chat.
export function GroupResearchSection({ group }: { group: GroupDetails }) {
  const status = useQuery(api.research.getStatus, { groupId: group._id });

  if (status === undefined) {
    return <p className="text-[13px] text-soft">Loading research...</p>;
  }
  if (status === null) {
    return <p className="text-[13px] text-soft">Group not found.</p>;
  }

  return (
    <div className="space-y-4">
      <ResearchSettingsCard group={group} status={status} />
      {status.enabled && (
        <ResearchWorkspace
          group={group}
          ready={status.index?.status === "ready"}
        />
      )}
    </div>
  );
}

function ResearchSettingsCard({
  group,
  status,
}: {
  group: GroupDetails;
  status: ResearchStatus;
}) {
  const setEnabled = useMutation(api.research.setEnabled);
  const refreshIndex = useMutation(api.research.refreshIndex);
  const setModel = useMutation(api.research.setModel);
  const { showConfirm, DialogComponents } = useDialog();
  const [toggling, setToggling] = useState(false);

  const index = status.index;
  const indexStatus = index?.status;

  // Tell the admin when indexing finishes, but only for a transition seen
  // in this session (not on every page load of an already ready group)
  const prevStatus = useRef(indexStatus);
  useEffect(() => {
    if (prevStatus.current === "indexing" && indexStatus === "ready") {
      toast.success("Research is ready. Ask away.");
    }
    if (prevStatus.current === "indexing" && indexStatus === "failed") {
      toast.error("Research indexing failed. Try refreshing the index.");
    }
    prevStatus.current = indexStatus;
  }, [indexStatus]);

  const applyEnabled = async (enabled: boolean) => {
    setToggling(true);
    try {
      await setEnabled({ groupId: group._id, enabled });
      if (enabled) toast.success("Indexing started. We'll tell you when it's ready.");
    } catch (error) {
      toast.error(getConvexErrorMessage(error, "Could not update research"));
    } finally {
      setToggling(false);
    }
  };

  const handleToggle = () => {
    if (!status.enabled) {
      void applyEnabled(true);
      return;
    }
    showConfirm(
      "Turn off research?",
      "The search index for this group is removed. Saved threads stay and come back when you turn research on again.",
      () => void applyEnabled(false),
      { confirmButtonText: "Turn off", confirmButtonVariant: "destructive" },
    );
  };

  const handleRefresh = async () => {
    try {
      await refreshIndex({ groupId: group._id });
      toast.success("Refreshing the index");
    } catch (error) {
      toast.error(getConvexErrorMessage(error, "Could not refresh the index"));
    }
  };

  const handleModel = async (model: string) => {
    try {
      await setModel({ groupId: group._id, model });
      toast.success(
        `Research now uses ${model ? researchModelLabel(model) : researchModelLabel(status.defaultModel)}`,
      );
    } catch (error) {
      toast.error(getConvexErrorMessage(error, "Could not change the model"));
    }
  };

  const modelOptions = [
    {
      value: "",
      label: `Default (${researchModelLabel(status.defaultModel)})`,
    },
    ...RESEARCH_MODELS.map((m) => ({
      value: m.id,
      label: `${m.label} · ${m.note}`,
    })),
  ];

  return (
    <SectionCard
      title="Research"
      description="An analyst chat that knows every submission, human score, judge comment, AI judge result, rule, and rubric in this group, plus the web. Off by default."
      headerAction={
        <TogglePill
          enabled={status.enabled}
          onToggle={handleToggle}
          onLabel="On"
          offLabel="Off"
          disabled={toggling}
        />
      }
    >
      {!status.enabled ? (
        <p className="text-[13px] text-soft">
          Turn research on to index this group. Indexing reads each submission
          once, then you can ask things like "compare the top 10" or "pick a
          winner and explain why".
        </p>
      ) : (
        <div className="space-y-4">
          <IndexStatusRow index={index} onRefresh={() => void handleRefresh()} />
          <div className="grid sm:grid-cols-[minmax(0,1fr)_auto] gap-2 items-center">
            <div>
              <p className="text-[13px] font-medium text-ink">Model</p>
              <p className="text-[12px] text-soft">
                Runs through the Convex AI Gateway. Applies to new answers for
                everyone in this group.
              </p>
            </div>
            <SimpleSelect
              value={status.override ?? ""}
              onChange={(value) => void handleModel(value)}
              options={modelOptions}
              aria-label="Research model"
              className="w-full sm:w-72 text-[13px]"
            />
          </div>
          <ResearchContextEditor
            key={status.context}
            groupId={group._id}
            saved={status.context}
          />
        </div>
      )}
      <DialogComponents />
    </SectionCard>
  );
}

const MAX_CONTEXT_CHARS = 20000;

// Organizer rules pasted from outside VibeApps (Luma, Devpost, Notion).
// Keyed by the saved value so the draft resets when anyone saves.
function ResearchContextEditor({
  groupId,
  saved,
}: {
  groupId: Id<"judgingGroups">;
  saved: string;
}) {
  const setContext = useMutation(api.research.setContext);
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  const dirty = draft.trim() !== saved;
  const tooLong = draft.trim().length > MAX_CONTEXT_CHARS;

  const handleSave = async () => {
    setSaving(true);
    try {
      await setContext({ groupId, context: draft });
      toast.success(draft.trim() ? "Rules and context saved" : "Rules and context cleared");
    } catch (error) {
      toast.error(getConvexErrorMessage(error, "Could not save rules and context"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div>
        <label htmlFor="research-context" className="text-[13px] font-medium text-ink">
          Rules and context
        </label>
        <p className="text-[12px] text-soft">
          The chat already reads this group's criteria, AI rubric, submit page,
          and How to judge notes. Paste anything else it should follow, like
          official rules, eligibility, prizes, or tracks. Markdown works.
        </p>
      </div>
      <textarea
        id="research-context"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={6}
        spellCheck
        className="w-full rounded-md border border-hairline bg-surface px-3 py-2 text-[13px] text-ink leading-relaxed resize-y focus:outline-none focus:border-hairline-strong"
      />
      <div className="flex items-center justify-between gap-3">
        <p className={`text-[12px] tabular-nums ${tooLong ? "text-red-600" : "text-faint"}`}>
          {draft.trim().length.toLocaleString()} / {MAX_CONTEXT_CHARS.toLocaleString()}
        </p>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              type="button"
              onClick={() => setDraft(saved)}
              disabled={saving}
              className="px-2.5 py-1 rounded-md border border-hairline bg-surface text-[12px] text-copy hover:text-ink hover:bg-surface-hover transition-colors"
            >
              Discard
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!dirty || tooLong || saving}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-ink text-surface text-[12px] hover:opacity-90 transition-opacity disabled:opacity-30"
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function IndexStatusRow({
  index,
  onRefresh,
}: {
  index: ResearchStatus["index"];
  onRefresh: () => void;
}) {
  if (!index || index.status === "indexing") {
    const processed = index?.processed ?? 0;
    const total = index?.total ?? 0;
    const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
    return (
      <div className="space-y-1.5">
        <p className="flex items-center gap-2 text-[13px] text-copy">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Indexing {processed.toLocaleString()} of {total.toLocaleString()}{" "}
          submissions
        </p>
        <div
          className="h-1.5 rounded-full bg-surface-alt overflow-hidden"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Indexing progress"
        >
          <div
            className="h-full bg-ink opacity-70 transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  const refreshButton = (
    <button
      type="button"
      onClick={onRefresh}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-hairline bg-surface text-[12px] text-copy hover:text-ink hover:bg-surface-hover transition-colors flex-shrink-0"
    >
      <RefreshCw className="w-3 h-3" />
      Refresh index
    </button>
  );

  if (index.status === "failed") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2">
        <p className="flex items-center gap-2 text-[13px] text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Indexing failed{index.error ? `: ${index.error}` : "."}
        </p>
        {refreshButton}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="text-[13px]">
        <p className="text-copy">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2 align-middle" />
          Ready · {index.total.toLocaleString()} submissions indexed
          {index.readyAt
            ? ` ${formatDistanceToNow(index.readyAt, { addSuffix: true })}`
            : ""}
        </p>
        {index.staleSince && (
          <p className="text-[12px] text-soft mt-0.5">
            Scores or submissions changed since then. Leaderboards in answers
            are always live; refresh to update search over dossiers.
          </p>
        )}
      </div>
      {refreshButton}
    </div>
  );
}

function ResearchWorkspace({
  group,
  ready,
}: {
  group: GroupDetails;
  ready: boolean;
}) {
  const threads = useQuery(api.research.listThreads, { groupId: group._id });
  const [searchParams, setSearchParams] = useSearchParams();

  // Active thread (and optionally one answer) live in the URL so links can
  // be shared. Threads outside the newest 50 resolve through getThread.
  const requested = searchParams.get("thread");
  const focusMessageId = searchParams.get("message");
  const listed = threads?.find((thread) => thread._id === requested) ?? null;
  const linked = useQuery(
    api.research.getThread,
    requested && threads !== undefined && !listed
      ? { groupId: group._id, threadId: requested }
      : "skip",
  );
  const activeThread = listed ?? linked ?? null;
  const resolving =
    requested !== null &&
    !listed &&
    (threads === undefined || linked === undefined);

  const clearParams = useCallback(
    (keys: Array<string>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const key of keys) next.delete(key);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Deleted, malformed, or other group thread link: explain and clean up
  const missingThread = requested !== null && linked === null;
  useEffect(() => {
    if (!missingThread) return;
    toast.error("That research thread was deleted or is not in this group.");
    clearParams(["thread", "message"]);
  }, [missingThread, clearParams]);

  const handleFocusMissing = useCallback(
    () => clearParams(["message"]),
    [clearParams],
  );

  const selectThread = (threadId: Id<"researchThreads"> | null) => {
    const next = new URLSearchParams(searchParams);
    if (threadId) next.set("thread", threadId);
    else next.delete("thread");
    next.delete("message");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="rounded-lg border border-hairline bg-surface overflow-hidden">
      <div className="flex flex-col md:flex-row h-[72vh] min-h-[540px]">
        <aside className="md:w-60 flex-shrink-0 border-b md:border-b-0 md:border-r border-hairline max-h-48 md:max-h-none">
          <ResearchThreadList
            threads={threads}
            activeId={activeThread?._id ?? null}
            onSelect={(threadId) => selectThread(threadId)}
            onNew={() => selectThread(null)}
          />
        </aside>
        <section className="flex-1 min-w-0 min-h-0">
          {resolving ? (
            <p className="flex items-center gap-2 px-4 py-4 text-[13px] text-soft">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Opening thread...
            </p>
          ) : (
            <ResearchChat
              key={activeThread?._id ?? "new"}
              groupId={group._id}
              groupName={group.name}
              groupSlug={group.slug}
              thread={activeThread}
              ready={ready}
              focusMessageId={activeThread ? focusMessageId : null}
              onFocusMissing={handleFocusMissing}
              onThreadCreated={(threadId) => selectThread(threadId)}
            />
          )}
        </section>
      </div>
    </div>
  );
}
