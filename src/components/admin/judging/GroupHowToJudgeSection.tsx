import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check, Copy, Download, ExternalLink, Plus, Trash2 } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";
import {
  GroupDetails,
  SectionCard,
  SaveFooter,
  TogglePill,
  UrlRow,
  dateTimeInputToTs,
  tsToDateTimeInput,
  useSaveState,
} from "./groupSection";
import {
  ACCESS_CODE_PLACEHOLDER,
  buildHowToJudgeMarkdown,
} from "../../../lib/howToJudgeMarkdown";

type ExtraLink = { label: string; url: string };

// Organizer side of the public How to judge page. Turn the page on or off,
// grab its link, edit the organizer-only fields, and export the whole guide
// as Markdown for a Google Doc. Everything else on the page (links, criteria,
// scale, counts, AI notes) is read live from the group and needs no editing.
export function GroupHowToJudgeSection({ group }: { group: GroupDetails }) {
  const pagePath = `/judging/${group.slug}/howtojudge`;
  const pageOn = group.howToJudge?.enabled !== false;

  return (
    <div className="space-y-4">
      <PageCard group={group} pagePath={pagePath} pageOn={pageOn} />
      <OrganizerFieldsCard group={group} />
    </div>
  );
}

// On/off switch, public link, and Markdown export
function PageCard({
  group,
  pagePath,
  pageOn,
}: {
  group: GroupDetails;
  pagePath: string;
  pageOn: boolean;
}) {
  const updateGroup = useMutation(api.judgingGroups.updateGroup);
  const [pending, setPending] = useState(false);
  const [toggleError, setToggleError] = useState("");

  // Toggle saves immediately and keeps every other organizer field intact
  const handleToggle = () => {
    setToggleError("");
    setPending(true);
    updateGroup({
      groupId: group._id,
      howToJudge: { ...(group.howToJudge ?? {}), enabled: !pageOn },
    })
      .catch((err) => {
        setToggleError(
          err instanceof Error ? err.message : "Failed to update the page",
        );
      })
      .finally(() => setPending(false));
  };

  return (
    <SectionCard
      title="How to judge page"
      description="A public one sheet for your judges: TL;DR, links, live criteria, status guide, AI review notes, and your organizer fields. It never shows a passcode, so it is safe to paste into Slack or email."
      headerAction={<ExportActions group={group} />}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-ink">Page status</p>
          <p className="text-xs text-soft">
            {pageOn
              ? "Anyone with the link can read the guide"
              : "The link shows a not found page until you turn it on"}
          </p>
        </div>
        <TogglePill
          enabled={pageOn}
          onToggle={handleToggle}
          onLabel="Live"
          offLabel="Off"
          disabled={pending}
        />
      </div>
      {toggleError && (
        <p className="text-[13px] text-red-600">{toggleError}</p>
      )}
      <UrlRow
        label="Public guide"
        path={pagePath}
        hint="Send this with the access code. Links, criteria, deadline, and queue size update live."
      />
      <div className="rounded-md border border-hairline bg-surface-alt px-3 py-2.5 text-xs text-soft space-y-1">
        <p>
          <span className="font-medium text-copy">Auto filled from this group:</span>{" "}
          judging link, results and AI results links when shareable, tag pages,
          criteria and scale, judges per submission, queue mode and counts,
          deadline, AI rubric labels, and whether judges see the AI review card.
        </p>
        <p>
          <span className="font-medium text-copy">Access code:</span> the page
          shows the literal{" "}
          <code className="font-mono text-ink">{ACCESS_CODE_PLACEHOLDER}</code>{" "}
          (or your custom note) and tells judges the real code arrives by Slack
          or email. Passcodes are never rendered.
        </p>
      </div>
    </SectionCard>
  );
}

// Copy Markdown, download .md, and open the live page. The export reads the
// same query the public page uses (preview mode) so the Google Doc matches
// the page word for word even while the page is switched off.
function ExportActions({ group }: { group: GroupDetails }) {
  const data = useQuery(api.judgingGroups.getHowToJudgePage, {
    slug: group.slug,
    preview: true,
  });
  const [copied, setCopied] = useState(false);
  const ready = data !== undefined && data !== null;

  const markdown = () =>
    ready ? buildHowToJudgeMarkdown(data, window.location.origin) : "";

  const handleCopy = async () => {
    if (!ready) return;
    try {
      await navigator.clipboard.writeText(markdown());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable; the download button still works
    }
  };

  const handleDownload = () => {
    if (!ready) return;
    const blob = new Blob([markdown()], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${group.slug}-how-to-judge.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const buttonClass =
    "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-hairline text-copy hover:bg-surface-hover transition-colors disabled:opacity-50";

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => void handleCopy()}
        disabled={!ready}
        className={buttonClass}
        title="Copy the whole guide as Markdown for Google Docs"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-600" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
        {copied ? "Copied" : "Copy Markdown"}
      </button>
      <button
        type="button"
        onClick={handleDownload}
        disabled={!ready}
        className={buttonClass}
        title="Download the guide as a .md file"
      >
        <Download className="w-3.5 h-3.5" />
        .md
      </button>
      <a
        href={`/judging/${group.slug}/howtojudge`}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass}
        title="Open the live page in a new tab"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        Preview
      </a>
    </div>
  );
}

// The fields only an organizer knows. Everything is optional; empty fields
// hide their section on the page. Markdown is allowed in the long text
// fields and rendered with the site's Markdown component.
function OrganizerFieldsCard({ group }: { group: GroupDetails }) {
  const updateGroup = useMutation(api.judgingGroups.updateGroup);
  const { saving, saved, error, setError, run } = useSaveState();
  const settings = group.howToJudge;

  const [accessCodeNote, setAccessCodeNote] = useState(
    settings?.accessCodeNote ?? "",
  );
  const [deadline, setDeadline] = useState(
    tsToDateTimeInput(settings?.deadlineAt),
  );
  const [contact, setContact] = useState(settings?.contact ?? "");
  const [privateRepoNote, setPrivateRepoNote] = useState(
    settings?.privateRepoNote ?? "",
  );
  const [assignments, setAssignments] = useState(settings?.assignments ?? "");
  const [notes, setNotes] = useState(settings?.notes ?? "");
  const [links, setLinks] = useState<Array<ExtraLink>>(
    () => (settings?.links ?? []).map((l) => ({ ...l })),
  );
  const [showResultsLink, setShowResultsLink] = useState(
    settings?.showResultsLink !== false,
  );

  const updateLink = (index: number, patch: Partial<ExtraLink>) => {
    setLinks((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const handleSave = () => {
    const cleanLinks = links
      .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
      .filter((l) => l.url.length > 0);
    for (const link of cleanLinks) {
      if (!/^https?:\/\//i.test(link.url)) {
        setError(`Links must start with http:// or https:// (${link.url})`);
        return;
      }
    }
    const deadlineAt = dateTimeInputToTs(deadline);
    if (deadline && deadlineAt === null) {
      setError("Enter a valid deadline or clear the field.");
      return;
    }
    void run(async () => {
      await updateGroup({
        groupId: group._id,
        howToJudge: {
          // Keep the on/off switch as it is; it saves from the card above
          ...(settings?.enabled === false ? { enabled: false } : {}),
          ...(accessCodeNote.trim() ? { accessCodeNote: accessCodeNote.trim() } : {}),
          ...(deadlineAt !== null ? { deadlineAt } : {}),
          ...(contact.trim() ? { contact: contact.trim() } : {}),
          ...(privateRepoNote.trim()
            ? { privateRepoNote: privateRepoNote.trim() }
            : {}),
          ...(assignments.trim() ? { assignments: assignments.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(cleanLinks.length > 0 ? { links: cleanLinks } : {}),
          ...(showResultsLink ? {} : { showResultsLink: false }),
        },
      });
      setLinks(cleanLinks);
    });
  };

  return (
    <SectionCard
      title="Organizer fields"
      description="Details only you know. Empty fields are hidden on the page and in the Markdown export."
      footer={
        <SaveFooter
          saving={saving}
          saved={saved}
          error={error}
          onSave={handleSave}
        />
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="htj-access-note">Access code note</Label>
          <Input
            id="htj-access-note"
            value={accessCodeNote}
            onChange={(e) => setAccessCodeNote(e.target.value)}
            placeholder={ACCESS_CODE_PLACEHOLDER}
            disabled={saving}
            className="mt-1 font-mono"
          />
          <p className="text-xs text-soft mt-1">
            Shown in place of the code. Leave blank for{" "}
            <code className="font-mono">{ACCESS_CODE_PLACEHOLDER}</code>. Do
            not paste the real code here.
          </p>
        </div>
        <div>
          <Label htmlFor="htj-deadline">Judging deadline</Label>
          <Input
            id="htj-deadline"
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            disabled={saving}
            className="mt-1"
          />
          <p className="text-xs text-soft mt-1">
            Your local time. Judges see it in their own zone. Blank hides the
            deadline and the countdown.
          </p>
        </div>
      </div>

      <div>
        <Label htmlFor="htj-contact">Contact</Label>
        <Input
          id="htj-contact"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="e.g. Questions? DM @organizer in Slack or email judges@example.com"
          disabled={saving}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="htj-private-repos">Private repositories</Label>
        <Textarea
          id="htj-private-repos"
          value={privateRepoNote}
          onChange={(e) => setPrivateRepoNote(e.target.value)}
          placeholder="e.g. Some teams kept their repo private. Request access with your GitHub handle in the #judges channel."
          rows={2}
          disabled={saving}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="htj-assignments">Judge assignments</Label>
        <Textarea
          id="htj-assignments"
          value={assignments}
          onChange={(e) => setAssignments(e.target.value)}
          placeholder="e.g. Track A judges: alice, bob. Track B judges: carol, dave. Markdown lists and links work."
          rows={3}
          disabled={saving}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="htj-notes">Notes from the organizer</Label>
        <Textarea
          id="htj-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything else judges should know. Markdown supported."
          rows={3}
          disabled={saving}
          className="mt-1"
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-hairline pt-4">
        <div>
          <p className="text-[13px] font-medium text-ink">Results link</p>
          <p className="text-xs text-soft">
            {showResultsLink
              ? "The results page link appears when results are public or have a passcode"
              : "The results page link is hidden from judges on this page"}
          </p>
        </div>
        <TogglePill
          enabled={showResultsLink}
          onToggle={() => setShowResultsLink((v) => !v)}
          onLabel="Shown"
          offLabel="Hidden"
          disabled={saving}
        />
      </div>

      <div className="border-t border-hairline pt-4 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-ink">Extra links</p>
            <p className="text-xs text-soft">
              Slack channel, rubric doc, schedule. Listed with the auto pulled
              links at the top and bottom of the page.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setLinks((prev) => [...prev, { label: "", url: "" }])
            }
            disabled={saving || links.length >= 10}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md border border-hairline text-copy hover:bg-surface-hover transition-colors disabled:opacity-50 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add link
          </button>
        </div>
        {links.map((row, index) => (
          <div
            key={index}
            className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2 items-center"
          >
            <Input
              value={row.label}
              onChange={(e) => updateLink(index, { label: e.target.value })}
              placeholder="Label"
              disabled={saving}
              aria-label={`Link ${index + 1} label`}
            />
            <Input
              value={row.url}
              onChange={(e) => updateLink(index, { url: e.target.value })}
              placeholder="https://"
              disabled={saving}
              className="font-mono"
              aria-label={`Link ${index + 1} URL`}
            />
            <button
              type="button"
              onClick={() =>
                setLinks((prev) => prev.filter((_, i) => i !== index))
              }
              disabled={saving}
              className="inline-flex items-center justify-center p-2 rounded-md text-faint hover:text-red-600 hover:bg-red-50 transition-colors"
              aria-label={`Remove link ${index + 1}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
