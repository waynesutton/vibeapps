import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { Plus, Ticket, X } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";
import {
  GroupDetails,
  HeaderSaveButton,
  SectionCard,
  SaveFooter,
  TogglePill,
  useSaveState,
} from "./groupSection";
import { LinkLedgerRow, type LinkEntry } from "./GroupLinksSection";

// Hackathon skill settings for one judging group: enable toggle,
// registration codes, markdown rules, endpoint URLs for event docs, and
// the list of teams that registered through the skill.
export function GroupHackathonSection({ group }: { group: GroupDetails }) {
  return (
    <div className="space-y-4">
      <HackathonSettingsCard group={group} />
      {group.hackathonSkillEnabled && <RegistrationsCard group={group} />}
    </div>
  );
}

function HackathonSettingsCard({ group }: { group: GroupDetails }) {
  const updateSettings = useMutation(api.hackathon.updateHackathonSettings);
  const { saving, saved, error, setError, run } = useSaveState();

  const [enabled, setEnabled] = useState(group.hackathonSkillEnabled ?? false);
  const [codes, setCodes] = useState<Array<string>>(
    () => group.hackathonRegistrationCodes ?? [],
  );
  const [newCode, setNewCode] = useState("");
  const [rules, setRules] = useState(group.hackathonRules ?? "");

  const addCode = () => {
    const code = newCode.trim().toUpperCase();
    if (!code) return;
    if (codes.includes(code)) {
      setError("That code is already in the list.");
      return;
    }
    setError("");
    setCodes((prev) => [...prev, code]);
    setNewCode("");
  };

  const removeCode = (code: string) => {
    setCodes((prev) => prev.filter((c) => c !== code));
  };

  const handleSave = () => {
    if (enabled && codes.length === 0) {
      setError("Add at least one registration code before enabling.");
      return;
    }
    void run(async () => {
      await updateSettings({
        groupId: group._id,
        enabled,
        codes,
        // Only send rules when they changed so updatedAt is not bumped
        // (and skills are not told to refetch) on unrelated saves.
        ...(rules.trim() !== (group.hackathonRules ?? "")
          ? { rules: rules.trim() || null }
          : {}),
      });
    });
  };

  // Endpoint URLs for copy/paste into event docs. Skill endpoints live on
  // the Convex site domain; the submit page is a normal app route.
  const convexSiteUrl = (
    (import.meta.env.VITE_CONVEX_URL as string | undefined) ?? ""
  ).replace(".convex.cloud", ".convex.site");
  const apiBase = `${convexSiteUrl}/api/hackathon/${group.slug}`;
  const links: Array<LinkEntry> = [
    {
      label: "Submit page",
      url: `${window.location.origin}/judging/${group.slug}/submit`,
      locked: !!group.hasSubmissionPagePassword,
      passwordSet: !!group.hasSubmissionPagePassword,
      note: "Where the skill sends developers to submit their project",
    },
    {
      label: "OpenAPI document",
      url: `${apiBase}/openapi.json`,
      locked: false,
      passwordSet: false,
      note: "Public discovery document describing the skill API",
    },
    {
      label: "Rules endpoint",
      url: `${apiBase}/rules.json`,
      locked: true,
      keyRequired: true,
      passwordSet: false,
      note: "Rules markdown, criteria, and AI rubric. Needs a registration code.",
    },
    {
      label: "Status endpoint",
      url: `${apiBase}/status?url=...`,
      locked: true,
      keyRequired: true,
      passwordSet: false,
      note: "Submission lifecycle for a project URL. Needs a registration code.",
    },
    {
      label: "Check endpoint",
      url: `${apiBase}/check`,
      locked: true,
      keyRequired: true,
      passwordSet: false,
      note: "POST pre-submit check: live URL, manifest, duplicates, event window",
    },
  ];

  return (
    <SectionCard
      title="Hackathon skill"
      description="Lets the /hackathon agent skill register teams, fetch rules, and check submission status for this event. Submissions still go through the submit page."
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
            Enable hackathon skill API
          </p>
          <p className="text-xs text-gray-500">
            {enabled
              ? "Teams with a registration code can use the skill endpoints"
              : "All hackathon skill endpoints return 403 for this group"}
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
          {/* Registration codes: shared multi-use codes teams pass to
              /hackathon start. Matched case-insensitively. */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-[13px] font-medium text-[#292929]">
              Registration codes
            </p>
            <p className="text-xs text-gray-500 mt-0.5 mb-2">
              Shared codes teams use with /hackathon start (e.g. AUG18-GLOBAL).
              Codes are stored uppercase and matched case-insensitively.
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCode();
                  }
                }}
                placeholder="e.g. AUG18-GLOBAL"
                disabled={saving}
                className="flex-1 font-mono"
              />
              <button
                type="button"
                onClick={addCode}
                disabled={saving || !newCode.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-medium rounded-md bg-[#292929] text-white hover:bg-[#525252] transition-colors disabled:opacity-50 flex-shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Add code
              </button>
            </div>
            {codes.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-2">
                {codes.map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-gray-200 bg-gray-50 text-xs font-mono text-[#292929]"
                  >
                    <Ticket className="w-3 h-3 text-gray-400" />
                    {code}
                    <button
                      type="button"
                      onClick={() => removeCode(code)}
                      disabled={saving}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                      aria-label={`Remove code ${code}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 mt-2">
                No codes yet. The skill cannot register teams without one.
              </p>
            )}
          </div>

          {/* Rules markdown the skill writes into each team's rules.md */}
          <div className="border-t border-gray-100 pt-4">
            <Label htmlFor="hackathon-rules">Rules (markdown)</Label>
            <p className="text-xs text-gray-500 mt-0.5 mb-2">
              The skill saves this into each team's rules.md and refetches when
              it changes. Judging criteria and the AI rubric are included in
              the payload automatically.
            </p>
            <Textarea
              id="hackathon-rules"
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              placeholder={"# Event rules\n\n- Build during the event window\n- Public repo or published hackathon.json\n- One submission per project URL"}
              rows={10}
              disabled={saving}
              className="font-mono text-xs leading-relaxed"
            />
            {group.hackathonRulesUpdatedAt && (
              <p className="text-xs text-gray-400 mt-1">
                Rules last updated{" "}
                {formatDistanceToNow(group.hackathonRulesUpdatedAt)} ago
              </p>
            )}
          </div>
        </>
      )}

      {/* Endpoint links appear after a successful save (server state) */}
      {group.hackathonSkillEnabled && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-[13px] font-medium text-[#292929]">
            Skill endpoints
          </p>
          <p className="text-xs text-gray-500 mt-0.5 mb-2">
            Copy these into your event docs so participating agents can find
            the API.
          </p>
          <div className="space-y-2">
            {links.map((entry) => (
              <LinkLedgerRow key={entry.label} {...entry} />
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// Teams that ran /hackathon start with one of this group's codes
function RegistrationsCard({ group }: { group: GroupDetails }) {
  const registrations = useQuery(api.hackathon.listRegistrations, {
    groupId: group._id,
  });

  return (
    <SectionCard
      title="Registered teams"
      description="Teams that registered through the hackathon skill. Registration is informational; it does not create a submission."
    >
      {registrations === undefined && (
        <p className="text-[13px] text-gray-500">Loading registrations...</p>
      )}
      {registrations && registrations.length === 0 && (
        <p className="text-[13px] text-gray-500">No teams registered yet.</p>
      )}
      {registrations && registrations.length > 0 && (
        <div className="rounded-md border border-gray-200 divide-y divide-gray-100">
          {registrations.map((registration) => (
            <div
              key={registration._id}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-[#292929] truncate">
                  {registration.teamName}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {registration.email ? `${registration.email} · ` : ""}
                  code {registration.code}
                </p>
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">
                {formatDistanceToNow(registration.registeredAt)} ago
              </span>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
