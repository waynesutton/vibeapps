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
  AI_FRONTEND_PLATFORM_DEFS,
  AI_RUBRIC_DEFS,
  DEFAULT_FRONTEND_PLATFORM_WEIGHTS,
  DEFAULT_RUBRIC_WEIGHTS,
  FRONTEND_CHECKER_KEY,
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
        <p className="text-[13px] text-soft">
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
          <p className="text-[13px] font-medium text-ink">
            Enable AI judge
          </p>
          <p className="text-xs text-soft">
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
              <p className="text-[13px] font-medium text-ink">
                Public AI results
              </p>
              <p className="text-xs text-soft">
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
          <div className="border-t border-hairline pt-4">
            <p className="text-[13px] font-medium text-ink">
              Event window
            </p>
            <p className="text-xs text-soft mt-0.5 mb-2">
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
        <div className="border-t border-hairline pt-4">
          <p className="text-[13px] font-medium text-ink">
            AI judge links
          </p>
          <p className="text-xs text-soft mt-0.5 mb-2">
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

// Preset custom criterion: deployed frontend check with per-platform hosting
// sub-weights (Codex Sites, Convex static hosting, Vercel, Netlify, Other).
// The detected platform's weight multiplies this criterion's weight in the
// weighted ranking.
const FRONTEND_CHECKER_PRESET = {
  key: FRONTEND_CHECKER_KEY,
  label: "Frontend checker",
  description:
    "Evaluate the deployed frontend using the FRONTEND HOSTING CHECK facts: is the live app reachable and working, how complete and polished is the UI, and does the deployment serve the app correctly. Name the detected hosting platform (Codex Sites, Convex static hosting, Vercel, Netlify, or other) in your reasoning. Score 1-10 on frontend quality and deployment; never change other criterion scores because of the hosting platform.",
};

// Rubric weights with a per-criterion on/off toggle. Disabled criteria are
// excluded from the AI prompt, scoring, and rankings on the next run. The
// components check preset appears here with an Add button until it is added.
function RubricWeightsCard({ group }: { group: GroupDetails }) {
  const updateAiRubricWeights = useMutation(api.aiJudge.updateAiRubricWeights);
  const updateAiCustomCriteria = useMutation(api.aiJudge.updateAiCustomCriteria);
  const { saving, saved, error, setError, run } = useSaveState();
  const [addingPreset, setAddingPreset] = useState<string | null>(null);
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
  const hasFrontendChecker = rubricDefs.some(
    (d) => d.key === FRONTEND_CHECKER_KEY,
  );

  const [weights, setWeights] = useState<Record<string, number>>(() => {
    const map = { ...DEFAULT_RUBRIC_WEIGHTS };
    for (const c of group.aiCustomCriteria || []) map[c.key] = 1;
    for (const w of group.aiRubricWeights || []) {
      if (w.key in map) map[w.key] = w.weight;
    }
    return map;
  });

  // Per-platform sub-weights for the frontend checker (default 1 everywhere)
  const [platformWeights, setPlatformWeights] = useState<Record<string, number>>(
    () => {
      const map = { ...DEFAULT_FRONTEND_PLATFORM_WEIGHTS };
      for (const w of group.aiFrontendWeights || []) {
        if (w.key in map) map[w.key] = w.weight;
      }
      return map;
    },
  );

  // Absent from the map = enabled. Initialized from the stored disabled list.
  const [disabled, setDisabled] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const key of group.aiDisabledCriteria || []) map[key] = true;
    return map;
  });

  const enabledCount = rubricDefs.filter((d) => !disabled[d.key]).length;

  // Explicit add for a preset criterion: saves immediately as a custom
  // criterion, then behaves like any other rubric row
  const handleAddPreset = (preset: {
    key: string;
    label: string;
    description: string;
  }) => {
    setPresetError("");
    setAddingPreset(preset.key);
    updateAiCustomCriteria({
      groupId: group._id,
      criteria: [...(group.aiCustomCriteria || []), { ...preset }],
    })
      .catch((err) => {
        setPresetError(
          err instanceof Error ? err.message : `Failed to add ${preset.label}`,
        );
      })
      .finally(() => setAddingPreset(null));
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
      // Platform weights only travel when the frontend checker is in the
      // rubric; the mutation clears storage when everything is default 1
      const frontendWeightsArray = AI_FRONTEND_PLATFORM_DEFS.map((def) => ({
        key: def.key,
        weight: platformWeights[def.key] ?? 1,
      }));
      await updateAiRubricWeights({
        groupId: group._id,
        weights: allDefault ? undefined : weightsArray,
        disabledKeys,
        ...(hasFrontendChecker
          ? { frontendWeights: frontendWeightsArray }
          : {}),
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
      <div className="rounded-md border border-hairline divide-y divide-hairline">
        {rubricDefs.map((def) => {
          const isOff = !!disabled[def.key];
          const isFrontendChecker = def.key === FRONTEND_CHECKER_KEY;
          return (
            <div key={def.key}>
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <span
                  className={`text-[13px] ${isOff ? "text-faint" : "text-copy"}`}
                >
                  {def.label}
                  {!def.builtIn && (
                    <span className="ml-2 text-xs text-faint">custom</span>
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

              {/* Frontend checker platform sub-weights. The detected hosting
                  platform's weight multiplies the criterion weight above. */}
              {isFrontendChecker && (
                <div className="pb-2 pl-7 pr-3 space-y-1">
                  <p className="text-xs text-faint pb-1">
                    Hosting platform weights: the detected platform multiplies
                    the frontend checker weight. 1 is neutral.
                  </p>
                  {AI_FRONTEND_PLATFORM_DEFS.map((platform) => (
                    <div
                      key={platform.key}
                      className="flex items-center justify-between gap-3"
                    >
                      <span
                        className={`text-[13px] ${isOff ? "text-faint" : "text-soft"}`}
                      >
                        {platform.label}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        step={0.5}
                        value={platformWeights[platform.key] ?? 1}
                        onChange={(e) =>
                          setPlatformWeights((prev) => ({
                            ...prev,
                            [platform.key]: Math.max(
                              0,
                              parseFloat(e.target.value) || 0,
                            ),
                          }))
                        }
                        disabled={saving || isOff}
                        className={`w-20 text-right tabular-nums ${isOff ? "opacity-50" : ""}`}
                        aria-label={`Weight for ${platform.label} hosting`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Preset criteria: explicit Add buttons so a deleted criterion
            never silently returns */}
        {!hasComponentsCheck && (
          <PresetRow
            preset={COMPONENTS_CHECK_PRESET}
            note="Scores repo-verified Convex component usage. Not added until you click Add."
            adding={addingPreset === COMPONENTS_CHECK_PRESET.key}
            disabled={
              addingPreset !== null ||
              rubricDefs.length - AI_RUBRIC_DEFS.length >= 10
            }
            onAdd={() => handleAddPreset(COMPONENTS_CHECK_PRESET)}
          />
        )}
        {!hasFrontendChecker && (
          <PresetRow
            preset={FRONTEND_CHECKER_PRESET}
            note="Scores the deployed frontend with per-platform weights for Codex Sites, Convex static hosting, Vercel, Netlify, and other. Not added until you click Add."
            adding={addingPreset === FRONTEND_CHECKER_PRESET.key}
            disabled={
              addingPreset !== null ||
              rubricDefs.length - AI_RUBRIC_DEFS.length >= 10
            }
            onAdd={() => handleAddPreset(FRONTEND_CHECKER_PRESET)}
          />
        )}
      </div>
      {presetError && <p className="text-[13px] text-red-600">{presetError}</p>}
    </SectionCard>
  );
}

// One preset criterion offer row in the Rubric weights card
function PresetRow({
  preset,
  note,
  adding,
  disabled,
  onAdd,
}: {
  preset: { key: string; label: string };
  note: string;
  adding: boolean;
  disabled: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 bg-surface-alt">
      <div className="min-w-0">
        <span className="text-[13px] text-soft">
          {preset.label}
          <span className="ml-2 text-xs text-faint">preset, not in rubric</span>
        </span>
        <p className="text-xs text-faint">{note}</p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-hairline text-copy hover:bg-surface-hover transition-colors disabled:opacity-50 shrink-0"
      >
        {adding ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Plus className="w-3 h-3" />
        )}
        Add to rubric
      </button>
    </div>
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
      description="Extra rubric criteria the AI judge scores alongside the built-in six. The agent reads the repo, live site, and project logs to score them. The components check and frontend checker presets are added from the Rubric weights card above."
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
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md border border-hairline text-copy hover:bg-surface-hover transition-colors disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          Add criterion
        </button>
        <span className="text-xs text-faint">{criteria.length}/10</span>
      </div>

      {criteria.length === 0 && (
        <p className="text-[13px] text-soft">
          No custom criteria. The AI judge uses only the built-in rubric.
        </p>
      )}

      {criteria.map((row, index) => (
        <div
          key={index}
          className="rounded-md border border-hairline px-3 py-3 space-y-2"
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
        <p className="text-[13px] text-soft">Loading prompt...</p>
      )}
      {promptConfig === null && (
        <p className="text-[13px] text-soft">Prompt unavailable.</p>
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
        <p className="text-xs text-soft">
          {isCustom
            ? "This group runs a custom prompt."
            : "This group runs the built-in default prompt."}
        </p>
        <button
          type="button"
          onClick={handleReset}
          disabled={saving || (!isCustom && text === defaultPrompt)}
          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md border border-hairline text-copy hover:bg-surface-hover transition-colors disabled:opacity-50 flex-shrink-0"
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
            <span className="text-faint">
              Saving the unchanged default keeps the built-in prompt.
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-3.5 py-1.5 text-[13px] font-medium rounded-md bg-cta text-on-cta hover:bg-cta-hover transition-colors disabled:opacity-50 flex-shrink-0"
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
          <p className="text-[13px] font-medium text-ink">
            Agent API for this group
          </p>
          <p className="text-xs text-soft">
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
          <p className="text-[13px] font-medium text-ink">
            Agent scores are advisory
          </p>
          <p className="text-xs text-soft">
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
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-medium rounded-md bg-cta text-on-cta hover:bg-cta-hover transition-colors disabled:opacity-50 flex-shrink-0"
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
        <p className="text-[13px] text-soft">Loading keys...</p>
      )}
      {agentKeys && agentKeys.length === 0 && (
        <p className="text-[13px] text-soft">No agent keys yet.</p>
      )}
      {agentKeys && agentKeys.length > 0 && (
        <div className="rounded-md border border-hairline divide-y divide-hairline">
          {agentKeys.map((key) => (
            <div
              key={key._id}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <div className="min-w-0 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-faint flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink truncate">
                    {key.name}
                    {key.revokedAt && (
                      <span className="ml-2 text-xs text-red-600 font-normal">
                        Revoked
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-soft">
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
                      : "border-hairline text-red-600 hover:bg-red-50"
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
