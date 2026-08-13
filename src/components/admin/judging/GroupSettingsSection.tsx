import { useState } from "react";
import { useMutation } from "convex/react";
import { useNavigate } from "react-router-dom";
import { Mail, Plus, Trash2, X } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";
import {
  GroupDetails,
  SectionCard,
  SaveFooter,
  TogglePill,
  useSaveState,
} from "./groupSection";
import { GroupSlugEditor } from "./GroupSlugEditor";

// Basic group settings: name, slug, description, active status, judges per
// submission, plus a delete danger zone for admins with judging.delete.
export function GroupSettingsSection({
  group,
  canDelete,
  canChangeSlug,
}: {
  group: GroupDetails;
  canDelete: boolean;
  canChangeSlug: boolean;
}) {
  const navigate = useNavigate();
  const updateGroup = useMutation(api.judgingGroups.updateGroup);
  const deleteGroup = useMutation(api.judgingGroups.deleteGroup);
  const { saving, saved, error, setError, run } = useSaveState();

  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description || "");
  const [isActive, setIsActive] = useState(group.isActive);
  const [judgesPerSubmission, setJudgesPerSubmission] = useState(
    group.judgesPerSubmission ?? 1,
  );
  const [scoreScale, setScoreScale] = useState<5 | 10>(
    group.scoreScale === 5 ? 5 : 10,
  );
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = () => {
    if (!name.trim()) {
      setError("Group name is required");
      return;
    }
    void run(async () => {
      await updateGroup({
        groupId: group._id,
        name: name.trim(),
        description: description.trim() || null,
        isActive,
        judgesPerSubmission,
        scoreScale,
      });
    });
  };

  // Two-step delete: first click arms, second click deletes and exits.
  const handleDelete = async () => {
    if (!deleteArmed) {
      setDeleteArmed(true);
      setTimeout(() => setDeleteArmed(false), 5000);
      return;
    }
    setDeleting(true);
    try {
      await deleteGroup({ groupId: group._id });
      navigate("/admin?tab=judging");
    } catch {
      setDeleting(false);
      setDeleteArmed(false);
    }
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title="General"
        description="Name and description shown to judges and used in public URLs."
        footer={
          <SaveFooter
            saving={saving}
            saved={saved}
            error={error}
            onSave={handleSave}
            disabled={!name.trim()}
          />
        }
      >
        <div>
          <Label htmlFor="group-name">Group name</Label>
          <Input
            id="group-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Best App Contest 2026"
            disabled={saving}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="group-slug">URL slug</Label>
          <div className="mt-1 flex items-center gap-2">
            <Input
              id="group-slug"
              value={`/judging/${group.slug}`}
              readOnly
              className="font-mono text-sm"
            />
            {canChangeSlug && (
              <GroupSlugEditor
                groupId={group._id}
                currentSlug={group.slug}
                variant="button"
              />
            )}
          </div>
          <p className="text-xs text-soft mt-1">
            Drives every public URL for this group (judging, submit, results,
            AI results, Agent API). Changing it breaks old links.
          </p>
        </div>
        <div>
          <Label htmlFor="group-description">Description</Label>
          <Textarea
            id="group-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Provide context about this judging group..."
            rows={3}
            disabled={saving}
            className="mt-1"
          />
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <div>
            <p className="text-[13px] font-medium text-ink">
              Group status
            </p>
            <p className="text-xs text-soft">
              {isActive
                ? "Judges can score submissions right now"
                : "Judges cannot access this group until activated"}
            </p>
          </div>
          <TogglePill
            enabled={isActive}
            onToggle={() => setIsActive((v) => !v)}
            onLabel="Active"
            offLabel="Inactive"
            disabled={saving}
          />
        </div>
        <div>
          <Label htmlFor="judges-per-submission">Judges per submission</Label>
          <Input
            id="judges-per-submission"
            type="number"
            min={1}
            max={20}
            value={judgesPerSubmission}
            onChange={(e) =>
              setJudgesPerSubmission(
                Math.max(1, parseInt(e.target.value) || 1),
              )
            }
            disabled={saving}
            className="mt-1 max-w-[120px]"
          />
          <p className="text-xs text-soft mt-1">
            {judgesPerSubmission === 1
              ? "Each submission is judged by a single judge."
              : `Each submission must be scored by ${judgesPerSubmission} different judges before it is marked complete.`}
          </p>
        </div>
        <div>
          <Label>Scoring scale</Label>
          <div className="mt-1 flex items-center gap-2" role="radiogroup" aria-label="Scoring scale">
            {([5, 10] as const).map((scale) => (
              <button
                key={scale}
                type="button"
                role="radio"
                aria-checked={scoreScale === scale}
                onClick={() => setScoreScale(scale)}
                disabled={saving}
                className={`px-3.5 py-1.5 text-[13px] font-medium rounded-md border transition-colors disabled:opacity-50 ${
                  scoreScale === scale
                    ? "bg-cta border-ink text-on-cta"
                    : "bg-surface border-hairline text-copy hover:bg-surface-hover"
                }`}
              >
                1 to {scale}
              </button>
            ))}
          </div>
          <p className="text-xs text-soft mt-1">
            Judges score every criterion from 1 to {scoreScale}. Changing the
            scale after judging starts keeps existing scores as they were
            entered.
          </p>
        </div>
      </SectionCard>

      <NotificationEmailsCard group={group} />

      {canDelete && (
        <div className="rounded-lg border border-red-200 bg-surface">
          <div className="px-5 pt-4 pb-1">
            <h3 className="text-sm font-semibold text-red-700">Danger zone</h3>
            <p className="text-[13px] text-soft mt-0.5">
              Deleting removes this group, its criteria, scores, and judge
              records. This cannot be undone.
            </p>
          </div>
          <div className="px-5 py-4">
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-medium rounded-md border transition-colors disabled:opacity-50 ${
                deleteArmed
                  ? "bg-red-600 border-red-600 text-white hover:bg-red-700"
                  : "bg-surface border-red-200 text-red-600 hover:bg-red-50"
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleting
                ? "Deleting..."
                : deleteArmed
                  ? "Click again to confirm"
                  : "Delete this group"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Organizer emails for the per-group new-submission alert. The list defines
// who receives it; the "New submission group alert" toggle in the admin
// Email dashboard controls whether the type sends at all.
function NotificationEmailsCard({ group }: { group: GroupDetails }) {
  const updateGroup = useMutation(api.judgingGroups.updateGroup);
  const { saving, saved, error, setError, run } = useSaveState();

  const [emails, setEmails] = useState<Array<string>>(
    () => group.notificationEmails ?? [],
  );
  const [newEmail, setNewEmail] = useState("");

  const addEmail = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (emails.includes(email)) {
      setError("That email is already in the list.");
      return;
    }
    setError("");
    setEmails((prev) => [...prev, email]);
    setNewEmail("");
  };

  const removeEmail = (email: string) => {
    setEmails((prev) => prev.filter((e) => e !== email));
  };

  const handleSave = () => {
    void run(async () => {
      await updateGroup({
        groupId: group._id,
        notificationEmails: emails.length > 0 ? emails : null,
      });
    });
  };

  return (
    <SectionCard
      title="Submission notifications"
      description="Organizers on this list get an email when a new submission lands in this group. Sends only while the 'New submission group alert' type is enabled in the admin Email dashboard."
      footer={
        <SaveFooter
          saving={saving}
          saved={saved}
          error={error}
          onSave={handleSave}
        />
      }
    >
      <div className="flex items-center gap-2">
        <Input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addEmail();
            }
          }}
          placeholder="organizer@example.com"
          disabled={saving}
          className="flex-1"
        />
        <button
          type="button"
          onClick={addEmail}
          disabled={saving || !newEmail.trim()}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-medium rounded-md bg-cta text-on-cta hover:bg-cta-hover transition-colors disabled:opacity-50 flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>
      {emails.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {emails.map((email) => (
            <span
              key={email}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-hairline bg-surface-alt text-xs text-ink"
            >
              <Mail className="w-3 h-3 text-faint" />
              {email}
              <button
                type="button"
                onClick={() => removeEmail(email)}
                disabled={saving}
                className="text-faint hover:text-red-600 transition-colors"
                aria-label={`Remove ${email}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-faint">
          No recipients. New-submission alerts are skipped for this group.
        </p>
      )}
    </SectionCard>
  );
}
