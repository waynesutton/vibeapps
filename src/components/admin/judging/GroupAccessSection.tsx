import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Lock, Send } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import {
  GroupDetails,
  SectionCard,
  SaveFooter,
  TogglePill,
  useSaveState,
} from "./groupSection";

// Access controls: judge access, submission page access, and results
// visibility. Password semantics match the old modal: blank keeps the
// stored password, switching to public clears it.
export function GroupAccessSection({ group }: { group: GroupDetails }) {
  const updateGroup = useMutation(api.judgingGroups.updateGroup);

  return (
    <div className="space-y-4">
      <JudgeAccessCard group={group} updateGroup={updateGroup} />
      <SubmitPageAccessCard group={group} updateGroup={updateGroup} />
      <ResultsAccessCard group={group} updateGroup={updateGroup} />
    </div>
  );
}

type UpdateGroupFn = ReturnType<
  typeof useMutation<typeof api.judgingGroups.updateGroup>
>;

function PasswordField({
  id,
  label,
  value,
  onChange,
  hasExisting,
  disabled,
  requiredHint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hasExisting: boolean;
  disabled: boolean;
  requiredHint?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={id} className="flex items-center gap-1.5">
        <Lock className="w-3.5 h-3.5" />
        {label}
      </Label>
      <Input
        id={id}
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          hasExisting
            ? "Leave blank to keep the existing password"
            : requiredHint
              ? "Set a password"
              : "Set a password (optional)"
        }
        disabled={disabled}
        className="mt-1"
      />
      <p className="text-xs text-soft mt-1">
        {hasExisting
          ? "A password is currently set. Leave blank to keep it, or enter a new one."
          : requiredHint
            ? "Required: private pages need a password."
            : "Optional password for access."}
      </p>
    </div>
  );
}

function JudgeAccessCard({
  group,
  updateGroup,
}: {
  group: GroupDetails;
  updateGroup: UpdateGroupFn;
}) {
  const { saving, saved, error, run } = useSaveState();
  const [isPublic, setIsPublic] = useState(group.isPublic);
  const [password, setPassword] = useState("");

  const handleSave = () => {
    void run(async () => {
      await updateGroup({
        groupId: group._id,
        isPublic,
        // Public clears the password; private keeps it unless a new one is typed
        ...(isPublic
          ? { judgePassword: null }
          : password.trim()
            ? { judgePassword: password.trim() }
            : {}),
      });
      setPassword("");
    });
  };

  return (
    <SectionCard
      title="Judge access"
      description="Controls who can open the judging interface."
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
            Public judge access
          </p>
          <p className="text-xs text-soft">
            {isPublic
              ? "Anyone with the link can access the judging interface"
              : "Judges need a password to access the interface"}
          </p>
        </div>
        <TogglePill
          enabled={isPublic}
          onToggle={() => setIsPublic((v) => !v)}
          onLabel="Public"
          offLabel="Private"
          disabled={saving}
        />
      </div>
      {!isPublic && (
        <PasswordField
          id="judge-password"
          label="Judge access password"
          value={password}
          onChange={setPassword}
          hasExisting={!!group.judgePassword}
          disabled={saving}
        />
      )}
    </SectionCard>
  );
}

function SubmitPageAccessCard({
  group,
  updateGroup,
}: {
  group: GroupDetails;
  updateGroup: UpdateGroupFn;
}) {
  const { saving, saved, error, run } = useSaveState();
  // If a password is stored, the submit page is currently private
  const [isPublic, setIsPublic] = useState(!group.submissionPagePassword);
  const [password, setPassword] = useState("");

  const handleSave = () => {
    void run(async () => {
      await updateGroup({
        groupId: group._id,
        ...(isPublic
          ? { submissionPagePassword: null }
          : password.trim()
            ? { submissionPagePassword: password.trim() }
            : {}),
      });
      setPassword("");
    });
  };

  return (
    <SectionCard
      title="Submission page access"
      description="Controls who can open the custom submission form."
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
            Public submission page
          </p>
          <p className="text-xs text-soft">
            {isPublic
              ? "Anyone with the link can access the custom submission form"
              : "The submission form asks for a password"}
          </p>
        </div>
        <TogglePill
          enabled={isPublic}
          onToggle={() => setIsPublic((v) => !v)}
          onLabel="Public"
          offLabel="Private"
          disabled={saving}
        />
      </div>
      {!isPublic && (
        <PasswordField
          id="submit-page-password"
          label="Submission page password"
          value={password}
          onChange={setPassword}
          hasExisting={!!group.submissionPagePassword}
          disabled={saving}
        />
      )}
    </SectionCard>
  );
}

function ResultsAccessCard({
  group,
  updateGroup,
}: {
  group: GroupDetails;
  updateGroup: UpdateGroupFn;
}) {
  const { saving, saved, error, setError, run } = useSaveState();
  const [isPublic, setIsPublic] = useState(group.resultsIsPublic ?? false);
  const [password, setPassword] = useState("");

  const handleSave = () => {
    // Private results always require a password (existing or new)
    if (!isPublic && !password.trim() && !group.resultsPassword) {
      setError(
        "Private results need a password. Set one or make results public.",
      );
      return;
    }
    void run(async () => {
      await updateGroup({
        groupId: group._id,
        resultsIsPublic: isPublic,
        ...(isPublic
          ? { resultsPassword: null }
          : password.trim()
            ? { resultsPassword: password.trim() }
            : {}),
      });
      setPassword("");
    });
  };

  return (
    <SectionCard
      title="Results visibility"
      description="Controls who can view the public judging results page."
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
            Public results
          </p>
          <p className="text-xs text-soft">
            {isPublic
              ? "Anyone with the link can view the judging results"
              : "The results page asks for a password"}
          </p>
        </div>
        <TogglePill
          enabled={isPublic}
          onToggle={() => setIsPublic((v) => !v)}
          onLabel="Public"
          offLabel="Private"
          disabled={saving}
        />
      </div>
      {!isPublic && (
        <PasswordField
          id="results-password"
          label="Results password"
          value={password}
          onChange={setPassword}
          hasExisting={!!group.resultsPassword}
          disabled={saving}
          requiredHint
        />
      )}
      {group.resultsIsPublic === true && <ResultsLiveEmailBlock group={group} />}
    </SectionCard>
  );
}

// Explicit "email all submitters" action shown once results are saved as
// public. Sends the public results URL to every de-duplicated submitter
// email in the group via the results_live email type.
function ResultsLiveEmailBlock({ group }: { group: GroupDetails }) {
  const status = useQuery(api.emails.submissions.getResultsLiveEmailStatus, {
    groupId: group._id,
  });
  const queueEmails = useMutation(api.emails.submissions.queueResultsLiveEmails);

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [armed, setArmed] = useState(false);

  const blocked =
    status !== undefined && (!status.emailsEnabled || !status.typeEnabled);

  // Two-step confirm using the site's inline-arm pattern (no browser popups)
  const handleClick = async () => {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 5000);
      return;
    }
    setSending(true);
    setError("");
    try {
      await queueEmails({ groupId: group._id });
      setSent(true);
      setTimeout(() => setSent(false), 5000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.replace(/^\[.*?\]\s*/, "").replace(/^Uncaught Error:\s*/, "")
          : "Failed to queue results emails.",
      );
    } finally {
      setSending(false);
      setArmed(false);
    }
  };

  return (
    <div className="border-t border-hairline pt-4">
      <p className="text-[13px] font-medium text-ink">
        Email submitters that results are live
      </p>
      <p className="text-xs text-soft mt-0.5 mb-2">
        Sends the public results link once to every submitter email in this
        group
        {status !== undefined
          ? ` (${status.recipientCount} recipient${status.recipientCount !== 1 ? "s" : ""})`
          : ""}
        . This is a manual, one-time send.
      </p>
      {blocked && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-2">
          {status && !status.emailsEnabled
            ? "The global email system is off."
            : 'The "Results live" email type is off.'}{" "}
          Enable it in the admin Email dashboard first.
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleClick()}
          disabled={
            sending ||
            blocked ||
            status === undefined ||
            status.recipientCount === 0
          }
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-medium rounded-md border transition-colors disabled:opacity-50 ${
            armed
              ? "bg-cta border-ink text-on-cta"
              : "bg-surface border-hairline text-ink hover:bg-surface-hover"
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          {sending
            ? "Queueing..."
            : armed
              ? "Click again to send"
              : "Email all submitters"}
        </button>
        {sent && (
          <span className="text-xs text-green-700">
            Results emails queued.
          </span>
        )}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
      {status !== undefined && status.recipientCount === 0 && !blocked && (
        <p className="text-xs text-faint mt-2">
          No submissions in this group have an email address.
        </p>
      )}
    </div>
  );
}
