import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";
import {
  AI_RUBRIC_DEFS,
  DEFAULT_RUBRIC_WEIGHTS,
  GroupDetails,
  HeaderSaveButton,
  SectionCard,
  SaveFooter,
  TogglePill,
  dateInputToEndTs,
  dateInputToStartTs,
  tsToDateInput,
  useSaveState,
} from "./groupSection";
import { LinkLedgerRow, type LinkEntry } from "./GroupLinksSection";

// AI judge configuration: enable toggle, AI results visibility, event
// window for the build-timeline check, rubric weights, custom criteria,
// the editable system prompt, and agent keys.
// Settings need judging.manage; the rest needs judging.ai.
export function GroupAiSection({
  group,
  canManage,
  canAi,
}: {
  group: GroupDetails;
  canManage: boolean;
  canAi: boolean;
}) {
  // Key the rubric and criteria cards by the server criteria list so both
  // resync when a criterion is added elsewhere (e.g. the components check
  // toggle in the weights card)
  const criteriaKey = (group.aiCustomCriteria || []).map((c) => c.key).join(",");

  return (
    <div className="space-y-4">
      {canManage && <AiSettingsCard group={group} />}
      {canAi && group.aiJudgeEnabled && (
        <RubricWeightsCard key={`weights-${criteriaKey}`} group={group} />
      )}
      {canAi && group.aiJudgeEnabled && (
        <CustomCriteriaCard key={`criteria-${criteriaKey}`} group={group} />
      )}
      {canAi && group.aiJudgeEnabled && <SystemPromptCard group={group} />}
      {canAi && group.aiJudgeEnabled && <AgentKeysCard group={group} />}
      {!canManage && !canAi && (
        <p className="text-[13px] text-gray-500">
          You do not have access to AI judge settings for this group.
        </p>
      )}
    </div>
  );
}

function AiSettingsCard({ group }: { group: GroupDetails }) {
  const updateGroup = useMutation(api.judgingGroups.updateGroup);
  const { saving, saved, error, setError, run } = useSaveState();

  const [enabled, setEnabled] = useState(group.aiJudgeEnabled ?? false);
  const [resultsPublic, setResultsPublic] = useState(
    group.aiResultsIsPublic ?? false,
  );
  const [password, setPassword] = useState("");
  const [eventStart, setEventStart] = useState(tsToDateInput(group.startDate));
  const [eventEnd, setEventEnd] = useState(tsToDateInput(group.endDate));

  // AI judge links shown once the AI judge is saved as enabled. Same entries
  // as the Links section so admins can grab URLs where they configure them.
  const convexSiteUrl = (
    (import.meta.env.VITE_CONVEX_URL as string | undefined) ?? ""
  ).replace(".convex.cloud", ".convex.site");
  const agentApiEnabled = group.agentKeysEnabled !== false;
  const aiLinks: Array<LinkEntry> = [
    {
      label: "AI results page",
      url: `${window.location.origin}/judging/${group.slug}/ai-results`,
      locked: !(group.aiResultsIsPublic ?? false),
      passwordSet: group.hasAiResultsPassword,
      note: (group.aiResultsIsPublic ?? false)
        ? "Public: anyone with the link sees AI scores"
        : "Private: visitors enter the AI results password",
    },
    ...(agentApiEnabled
      ? [
          {
            label: "OpenAPI document",
            url: `${convexSiteUrl}/api/judging/${group.slug}/openapi.json`,
            locked: false,
            passwordSet: false,
            note: "Public discovery document describing the agent API",
          },
          {
            label: "API base URL",
            url: `${convexSiteUrl}/api/judging/${group.slug}`,
            locked: true,
            keyRequired: true,
            passwordSet: false,
            note: "criteria.json, submissions.json, results.json, and POST /scores need a valid agent key",
          },
        ]
      : []),
  ];

  const handleSave = () => {
    if (
      enabled &&
      !resultsPublic &&
      !password.trim() &&
      !group.hasAiResultsPassword
    ) {
      setError(
        "Private AI results need a password. Set one or make them public.",
      );
      return;
    }
    void run(async () => {
      await updateGroup({
        groupId: group._id,
        aiJudgeEnabled: enabled,
        aiResultsIsPublic: resultsPublic,
        startDate: dateInputToStartTs(eventStart),
        endDate: dateInputToEndTs(eventEnd),
        ...(resultsPublic
          ? { aiResultsPassword: null }
          : password.trim()
            ? { aiResultsPassword: password.trim() }
            : {}),
      });
      setPassword("");
    });
  };

  return (
    <SectionCard
      title="AI judge"
      description="Automated Best Use of Convex scoring across the rubric."
      headerAction={
        enabled ? (
          <HeaderSaveButton saving={saving} saved={saved} onSave={handleSave} />
        ) : undefined
      }
      footer={
        <SaveFooter
          saving={saving}
          saved={saved}
          error={error}
          onSave={handleSave}
        />
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-[#292929]">
            Enable AI judge
          </p>
          <p className="text-xs text-gray-500">
            {enabled
              ? "AI analysis and the AI results page are available"
              : "AI analysis is off for this group"}
          </p>
        </div>
        <TogglePill
          enabled={enabled}
          onToggle={() => setEnabled((v) => !v)}
          onLabel="Enabled"
          offLabel="Disabled"
          disabled={saving}
        />
      </div>

      {enabled && (
        <>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium text-[#292929]">
                Public AI results
              </p>
              <p className="text-xs text-gray-500">
                {resultsPublic
                  ? "Anyone with the link can view AI results"
                  : "The AI results page asks for a password"}
              </p>
            </div>
            <TogglePill
              enabled={resultsPublic}
              onToggle={() => setResultsPublic((v) => !v)}
              onLabel="Public"
              offLabel="Private"
              disabled={saving}
            />
          </div>
          {!resultsPublic && (
            <div>
              <Label htmlFor="ai-results-password">AI results password</Label>
              <Input
                id="ai-results-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  group.hasAiResultsPassword
                    ? "Leave blank to keep the existing password"
                    : "Set a password"
                }
                disabled={saving}
                className="mt-1"
              />
            </div>
          )}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-[13px] font-medium text-[#292929]">
              Event window
            </p>
            <p className="text-xs text-gray-500 mt-0.5 mb-2">
              Used by the build-timeline check to verify apps were built during
              the event.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="event-start">Event start</Label>
                <Input
                  id="event-start"
                  type="date"
                  value={eventStart}
                  onChange={(e) => setEventStart(e.target.value)}
                  disabled={saving}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="event-end">Event end</Label>
                <Input
                  id="event-end"
                  type="date"
                  value={eventEnd}
                  onChange={(e) => setEventEnd(e.target.value)}
                  disabled={saving}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Links appear after a successful save (server state, not the local toggle) */}
      {group.aiJudgeEnabled && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-[13px] font-medium text-[#292929]">
            AI judge links
          </p>
          <p className="text-xs text-gray-500 mt-0.5 mb-2">
            Share these with organizers and agents. They are also listed in the
            Links section.
          </p>
          <div className="space-y-2">
            {aiLinks.map((entry) => (
              <LinkLedgerRow key={entry.label} {...entry} />
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// Preset custom criterion: repo-verified Convex components usage check.
// Offered in the Rubric weights card behind an explicit Add button so a
// deleted criterion never comes back without a deliberate click.
const COMPONENTS_CHECK_PRESET = {
  key: "components-check",
  label: "Components check",
  description:
    "Check the GitHub repository for Convex components: which are installed (package.json, convex.config.ts) and which are actually referenced in code via components.<name>. Score how many components are genuinely integrated and how well they are used.",
};

// Rubric weights with a per-criterion on/off toggle. Disabled criteria are
// excluded from the AI prompt, scoring, and rankings on the next run. The
// components check preset appears here with an Add button until it is added.
function RubricWeightsCard({ group }: { group: GroupDetails }) {
  const updateAiRubricWeights = useMutation(api.aiJudge.updateAiRubricWeights);
  const updateAiCustomCriteria = useMutation(api.aiJudge.updateAiCustomCriteria);
  const { saving, saved, error, setError, run } = useSaveState();
  const [addingPreset, setAddingPreset] = useState(false);
  const [presetError, setPresetError] = useState("");

  // Effective rubric: built-in criteria plus this group's custom criteria
  const rubricDefs = [
    ...AI_RUBRIC_DEFS.map((d) => ({ ...d, builtIn: true })),
    ...(group.aiCustomCriteria || []).map((c) => ({
      key: c.key,
      label: c.label,
      builtIn: false,
    })),
  ];
  const hasComponentsCheck = rubricDefs.some(
    (d) => d.key === COMPONENTS_CHECK_PRESET.key,
  );

  const [weights, setWeights] = useState<Record<string, number>>(() => {
    const map = { ...DEFAULT_RUBRIC_WEIGHTS };
    for (const c of group.aiCustomCriteria || []) map[c.key] = 1;
    for (const w of group.aiRubricWeights || []) {
      if (w.key in map) map[w.key] = w.weight;
    }
    return map;
  });

  // Absent from the map = enabled. Initialized from the stored disabled list.
  const [disabled, setDisabled] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const key of group.aiDisabledCriteria || []) map[key] = true;
    return map;
  });

  const enabledCount = rubricDefs.filter((d) => !disabled[d.key]).length;

  // Explicit add for the components check preset: saves immediately as a
  // custom criterion, then behaves like any other rubric row
  const handleAddComponentsCheck = () => {
    setPresetError("");
    setAddingPreset(true);
    updateAiCustomCriteria({
      groupId: group._id,
      criteria: [...(group.aiCustomCriteria || []), { ...COMPONENTS_CHECK_PRESET }],
    })
      .catch((err) => {
        setPresetError(
          err instanceof Error ? err.message : "Failed to add components check",
        );
      })
      .finally(() => setAddingPreset(false));
  };

  const handleSave = () => {
    if (enabledCount === 0) {
      setError("At least one criterion must stay on.");
      return;
    }
    void run(async () => {
      const weightsArray = rubricDefs.map((def) => ({
        key: def.key,
        weight: weights[def.key] ?? 1,
      }));
      // All-default weights clear the stored field so ranking falls back
      // to the plain total
      const allDefault = weightsArray.every((w) => w.weight === 1);
      const disabledKeys = rubricDefs
        .filter((def) => disabled[def.key])
        .map((def) => def.key);
      await updateAiRubricWeights({
        groupId: group._id,
        weights: allDefault ? undefined : weightsArray,
        disabledKeys,
      });
    });
  };

  return (
    <SectionCard
      title="Rubric weights"
      description="Toggle criteria on or off and multiply each score in the weighted ranking. 1 is neutral. Off criteria are skipped by the AI judge on the next run."
      footer={
        <SaveFooter
          saving={saving}
          saved={saved}
          error={error}
          onSave={handleSave}
          label="Save weights"
        />
      }
    >
      <div className="rounded-md border border-gray-200 divide-y divide-gray-100">
        {rubricDefs.map((def) => {
          const isOff = !!disabled[def.key];
          return (
            <div
              key={def.key}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <span
                className={`text-[13px] ${isOff ? "text-gray-400" : "text-gray-700"}`}
              >
                {def.label}
                {!def.builtIn && (
                  <span className="ml-2 text-xs text-gray-400">custom</span>
                )}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Input
                  type="number"
                  min={0}
                  max={10}
                  step={0.5}
                  value={weights[def.key] ?? 1}
                  onChange={(e) =>
                    setWeights((prev) => ({
                      ...prev,
                      [def.key]: Math.max(0, parseFloat(e.target.value) || 0),
                    }))
                  }
                  disabled={saving || isOff}
                  className={`w-20 text-right tabular-nums ${isOff ? "opacity-50" : ""}`}
                  aria-label={`Weight for ${def.label}`}
                />
                <TogglePill
                  enabled={!isOff}
                  onToggle={() =>
                    setDisabled((prev) => ({ ...prev, [def.key]: !prev[def.key] }))
                  }
                  onLabel="On"
                  offLabel="Off"
                  disabled={saving}
                />
              </div>
            </div>
          );
        })}

        {/* Components check preset: explicit Add button so a deleted
            criterion never silently returns */}
        {!hasComponentsCheck && (
          <div className="flex items-center justify-between gap-3 px-3 py-2 bg-gray-50/60">
            <div className="min-w-0">
              <span className="text-[13px] text-gray-500">
                {COMPONENTS_CHECK_PRESET.label}
                <span className="ml-2 text-xs text-gray-400">
                  preset, not in rubric
                </span>
              </span>
              <p className="text-xs text-gray-400">
                Scores repo-verified Convex component usage. Not added until
                you click Add.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddComponentsCheck}
              disabled={
                addingPreset || rubricDefs.length - AI_RUBRIC_DEFS.length >= 10
              }
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 shrink-0"
            >
              {addingPreset ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Plus className="w-3 h-3" />
              )}
              Add to rubric
            </button>
          </div>
        )}
      </div>
      {presetError && <p className="text-[13px] text-red-600">{presetError}</p>}
    </SectionCard>
  );
}

// Editor for admin-defined custom rubric criteria the AI judge scores in
// addition to the built-in six. Includes a one-click components check preset.
function CustomCriteriaCard({ group }: { group: GroupDetails }) {
  const updateAiCustomCriteria = useMutation(api.aiJudge.updateAiCustomCriteria);
  const { saving, saved, error, setError, run } = useSaveState();

  const [criteria, setCriteria] = useState<
    Array<{ key: string; label: string; description: string }>
  >(() => (group.aiCustomCriteria || []).map((c) => ({ ...c })));

  const slugify = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);

  const updateRow = (
    index: number,
    patch: Partial<{ key: string; label: string; description: string }>,
  ) => {
    setCriteria((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const handleSave = () => {
    for (const row of criteria) {
      if (!row.key.trim() || !row.label.trim() || !row.description.trim()) {
        setError("Every criterion needs a key, a label, and a description.");
        return;
      }
    }
    void run(async () => {
      await updateAiCustomCriteria({
        groupId: group._id,
        criteria:
          criteria.length > 0
            ? criteria.map((c) => ({
                key: c.key.trim(),
                label: c.label.trim(),
                description: c.description.trim(),
              }))
            : undefined,
      });
    });
  };

  return (
    <SectionCard
      title="Custom AI criteria"
      description="Extra rubric criteria the AI judge scores alongside the built-in six. The agent reads the repo, live site, and project logs to score them. The components check preset is added from the Rubric weights card above."
      footer={
        <SaveFooter
          saving={saving}
          saved={saved}
          error={error}
          onSave={handleSave}
          label="Save criteria"
        />
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            setCriteria((prev) => [...prev, { key: "", label: "", description: "" }])
          }
          disabled={saving || criteria.length >= 10}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          Add criterion
        </button>
        <span className="text-xs text-gray-400">{criteria.length}/10</span>
      </div>

      {criteria.length === 0 && (
        <p className="text-[13px] text-gray-500">
          No custom criteria. The AI judge uses only the built-in rubric.
        </p>
      )}

      {criteria.map((row, index) => (
        <div
          key={index}
          className="rounded-md border border-gray-200 px-3 py-3 space-y-2"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label htmlFor={`crit-label-${index}`}>Label</Label>
              <Input
                id={`crit-label-${index}`}
                value={row.label}
                onChange={(e) => {
                  const label = e.target.value;
                  // Keep the key in sync with the label until manually edited
                  updateRow(index, {
                    label,
                    ...(row.key === slugify(row.label)
                      ? { key: slugify(label) }
                      : {}),
                  });
                }}
                placeholder="e.g. Accessibility"
                disabled={saving}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor={`crit-key-${index}`}>Key</Label>
              <Input
                id={`crit-key-${index}`}
                value={row.key}
                onChange={(e) => updateRow(index, { key: slugify(e.target.value) })}
                placeholder="lowercase-slug"
                disabled={saving}
                className="mt-1 font-mono"
              />
            </div>
          </div>
          <div>
            <Label htmlFor={`crit-desc-${index}`}>
              Description (what the agent should look for)
            </Label>
            <Textarea
              id={`crit-desc-${index}`}
              value={row.description}
              onChange={(e) => updateRow(index, { description: e.target.value })}
              placeholder="Tell the AI judge exactly what to check in the repo or live app for this criterion..."
              rows={2}
              disabled={saving}
              className="mt-1"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() =>
                setCriteria((prev) => prev.filter((_, i) => i !== index))
              }
              disabled={saving}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove
            </button>
          </div>
        </div>
      ))}
    </SectionCard>
  );
}

// Editable AI judge system prompt with a reset-to-default action. The JSON
// response contract is always appended server-side and is not editable, so
// a custom prompt can never break score parsing.
function SystemPromptCard({ group }: { group: GroupDetails }) {
  const promptConfig = useQuery(api.aiJudge.getAiPromptConfig, {
    groupId: group._id,
  });

  return (
    <SectionCard
      title="AI judge system prompt"
      description="Edit, paste, or reset the prompt body the AI judge runs with. {{rubric}} expands to the criteria list; the JSON response format is always enforced separately."
    >
      {promptConfig === undefined && (
        <p className="text-[13px] text-gray-500">Loading prompt...</p>
      )}
      {promptConfig === null && (
        <p className="text-[13px] text-gray-500">Prompt unavailable.</p>
      )}
      {promptConfig && (
        <SystemPromptEditor
          groupId={group._id}
          defaultPrompt={promptConfig.defaultPrompt}
          customPrompt={promptConfig.customPrompt}
        />
      )}
    </SectionCard>
  );
}

function SystemPromptEditor({
  groupId,
  defaultPrompt,
  customPrompt,
}: {
  groupId: Id<"judgingGroups">;
  defaultPrompt: string;
  customPrompt?: string;
}) {
  const updateAiSystemPrompt = useMutation(api.aiJudge.updateAiSystemPrompt);
  const { saving, saved, error, run } = useSaveState();

  const [text, setText] = useState(customPrompt ?? defaultPrompt);
  const isCustom = customPrompt !== undefined;

  const handleSave = () => {
    void run(async () => {
      await updateAiSystemPrompt({ groupId, prompt: text });
    });
  };

  // Reset restores the built-in default both locally and in the database
  const handleReset = () => {
    setText(defaultPrompt);
    void run(async () => {
      await updateAiSystemPrompt({ groupId, prompt: null });
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          {isCustom
            ? "This group runs a custom prompt."
            : "This group runs the built-in default prompt."}
        </p>
        <button
          type="button"
          onClick={handleReset}
          disabled={saving || (!isCustom && text === defaultPrompt)}
          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 flex-shrink-0"
        >
          <RotateCcw className="w-3 h-3" />
          Reset to default
        </button>
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
        disabled={saving}
        className="font-mono text-xs leading-relaxed"
        aria-label="AI judge system prompt"
      />
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-[13px]">
          {error ? (
            <span className="text-red-600">{error}</span>
          ) : saved ? (
            <span className="text-green-700 inline-flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          ) : (
            <span className="text-gray-400">
              Saving the unchanged default keeps the built-in prompt.
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-3.5 py-1.5 text-[13px] font-medium rounded-md bg-[#292929] text-white hover:bg-[#525252] transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {saving ? "Saving..." : "Save prompt"}
        </button>
      </div>
    </div>
  );
}

function AgentKeysCard({ group }: { group: GroupDetails }) {
  const createAgentKey = useAction(api.agentJudges.createAgentKey);
  const revokeAgentKey = useMutation(api.agentJudges.revokeAgentKey);
  const updateAgentScoresAdvisory = useMutation(
    api.agentJudges.updateAgentScoresAdvisory,
  );
  const updateAgentKeysEnabled = useMutation(
    api.agentJudges.updateAgentKeysEnabled,
  );
  const agentKeys = useQuery(api.agentJudges.listAgentKeys, {
    groupId: group._id,
  });

  // Absent = enabled (default); false = agent API off for this group
  const apiEnabled = group.agentKeysEnabled !== false;

  const [keyName, setKeyName] = useState("");
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [keyError, setKeyError] = useState("");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revokeArmedId, setRevokeArmedId] =
    useState<Id<"agentJudgeKeys"> | null>(null);

  // Create a key; the raw key is shown once and never retrievable again
  const handleCreate = async () => {
    setKeyError("");
    if (keyName.trim().length < 2) {
      setKeyError("Key name must be at least 2 characters long");
      return;
    }
    setCreating(true);
    try {
      const result = await createAgentKey({
        groupId: group._id,
        name: keyName.trim(),
      });
      setNewRawKey(result.rawKey);
      setKeyName("");
    } catch (err) {
      setKeyError(
        err instanceof Error ? err.message : "Failed to create agent key",
      );
    } finally {
      setCreating(false);
    }
  };

  const handleCopyKey = async () => {
    if (!newRawKey) return;
    try {
      await navigator.clipboard.writeText(newRawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Key stays visible for manual copy
    }
  };

  // Two-step revoke to avoid accidental clicks
  const handleRevoke = (keyId: Id<"agentJudgeKeys">) => {
    if (revokeArmedId === keyId) {
      void revokeAgentKey({ keyId });
      setRevokeArmedId(null);
    } else {
      setRevokeArmedId(keyId);
      setTimeout(() => setRevokeArmedId(null), 5000);
    }
  };

  return (
    <SectionCard
      title="Agent judge keys"
      description="API keys that let external AI agents submit scores through the judging HTTP API."
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-[#292929]">
            Agent API for this group
          </p>
          <p className="text-xs text-gray-500">
            {apiEnabled
              ? "External agents with a key can read submissions and post scores"
              : "All agent API calls return 403 and new keys cannot be created. Keys are kept and work again when re-enabled."}
          </p>
        </div>
        <TogglePill
          enabled={apiEnabled}
          onToggle={() =>
            void updateAgentKeysEnabled({
              groupId: group._id,
              enabled: !apiEnabled,
            })
          }
          onLabel="Enabled"
          offLabel="Disabled"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-[#292929]">
            Agent scores are advisory
          </p>
          <p className="text-xs text-gray-500">
            {group.agentScoresAdvisory
              ? "Agent scores are shown separately and excluded from official rankings"
              : "Agent scores count toward official rankings"}
          </p>
        </div>
        <TogglePill
          enabled={group.agentScoresAdvisory ?? false}
          onToggle={() =>
            void updateAgentScoresAdvisory({
              groupId: group._id,
              advisory: !(group.agentScoresAdvisory ?? false),
            })
          }
          onLabel="Advisory"
          offLabel="Counted"
        />
      </div>

      {/* One-time raw key display */}
      {newRawKey && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="text-xs font-medium text-amber-800 mb-1.5">
            Copy this key now. It will not be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-mono text-amber-900 break-all">
              {newRawKey}
            </code>
            <button
              type="button"
              onClick={() => void handleCopyKey()}
              className="p-1.5 text-amber-700 hover:text-amber-900 rounded transition-colors flex-shrink-0"
              aria-label="Copy agent key"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setNewRawKey(null)}
            className="text-xs text-amber-700 hover:text-amber-900 mt-1.5 font-medium"
          >
            I copied it, dismiss
          </button>
        </div>
      )}

      {/* Create key (blocked while the agent API is disabled) */}
      <div className="flex items-center gap-2">
        <Input
          value={keyName}
          onChange={(e) => setKeyName(e.target.value)}
          placeholder="Key name, e.g. claude-agent"
          disabled={creating || !apiEnabled}
          className="flex-1"
        />
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={creating || !apiEnabled}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-medium rounded-md bg-[#292929] text-white hover:bg-[#525252] transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {creating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          Create key
        </button>
      </div>
      {keyError && <p className="text-[13px] text-red-600">{keyError}</p>}

      {/* Existing keys */}
      {agentKeys === undefined && (
        <p className="text-[13px] text-gray-500">Loading keys...</p>
      )}
      {agentKeys && agentKeys.length === 0 && (
        <p className="text-[13px] text-gray-500">No agent keys yet.</p>
      )}
      {agentKeys && agentKeys.length > 0 && (
        <div className="rounded-md border border-gray-200 divide-y divide-gray-100">
          {agentKeys.map((key) => (
            <div
              key={key._id}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <div className="min-w-0 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[#292929] truncate">
                    {key.name}
                    {key.revokedAt && (
                      <span className="ml-2 text-xs text-red-600 font-normal">
                        Revoked
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {key.scoreCount} score{key.scoreCount === 1 ? "" : "s"}
                    {key.lastUsedAt
                      ? ` · last used ${formatDistanceToNow(key.lastUsedAt)} ago`
                      : " · never used"}
                  </p>
                </div>
              </div>
              {!key.revokedAt && (
                <button
                  type="button"
                  onClick={() => handleRevoke(key._id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors flex-shrink-0 ${
                    revokeArmedId === key._id
                      ? "bg-red-600 border-red-600 text-white"
                      : "border-gray-200 text-red-600 hover:bg-red-50"
                  }`}
                >
                  {revokeArmedId === key._id ? "Confirm revoke" : "Revoke"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
