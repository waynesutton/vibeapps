import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Eye, Mail, Send } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  TEMPLATE_VARIABLES,
  applyTemplateVars,
  judgingGroupUrls,
  renderMarkdownLite,
  templateEmailShell,
} from "../../../../convex/emails/render";
import AlertDialog from "../../ui/AlertDialog";
import { SimpleSelect } from "../../ui/SimpleSelect";
import { GroupDetails, SectionCard } from "./groupSection";

type RecipientAudience = "judges" | "submission_owners";

type PickerRecipient = {
  id: string;
  name: string;
  email: string;
  detail?: string;
};

// Emails section of the judging group workspace: pick audience (judges or
// submission owners), template, message, recipients and reply-to, then
// preview, test, and send. Server-side gate: judging.emails on this group.
export function GroupEmailsSection({ group }: { group: GroupDetails }) {
  // Stable "now" for the daily-cap window so the query args don't change on
  // every render (queries must stay deterministic, no Date.now() server side)
  const [loadedAt] = useState(() => Date.now());
  const [audience, setAudience] = useState<RecipientAudience>("judges");

  const status = useQuery(api.emails.judgingGroupEmails.getGroupEmailStatus, {
    groupId: group._id,
    now: loadedAt,
  });
  const judgeRecipients = useQuery(
    api.emails.judgingGroupEmails.listGroupRecipients,
    audience === "judges" ? { groupId: group._id } : "skip",
  );
  const ownerRecipients = useQuery(
    api.emails.judgingGroupEmails.listGroupSubmissionOwnerRecipients,
    audience === "submission_owners" ? { groupId: group._id } : "skip",
  );
  const recentSends = useQuery(api.emails.judgingGroupEmails.listGroupSends, {
    groupId: group._id,
  });
  const scheduledSends = useQuery(
    api.emails.judgingGroupEmails.listScheduledEmails,
    { groupId: group._id },
  );
  const templates = useQuery(api.emailTemplates.listTemplates, {});

  const sendGroupEmail = useMutation(
    api.emails.judgingGroupEmails.sendGroupEmail,
  );
  const sendGroupTestEmail = useMutation(
    api.emails.judgingGroupEmails.sendGroupTestEmail,
  );
  const cancelScheduledEmail = useMutation(
    api.emails.judgingGroupEmails.cancelScheduledEmail,
  );

  // Compose state. Recipients default to everyone; excluded holds opt-outs
  // so no effect is needed to sync with the loaded list.
  const [templateId, setTemplateId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [signature, setSignature] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [scheduleAt, setScheduleAt] = useState("");
  const [previewRecipientId, setPreviewRecipientId] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelTarget, setCancelTarget] =
    useState<Id<"groupScheduledEmails"> | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const isJudges = audience === "judges";
  const audienceNoun = isJudges ? "judge" : "submission owner";
  const audienceNounPlural = isJudges ? "judges" : "submission owners";

  const recipients: Array<PickerRecipient> | undefined = isJudges
    ? judgeRecipients?.map((r) => ({
        id: r.judgeId as string,
        name: r.name,
        email: r.email,
      }))
    : ownerRecipients?.map((r) => ({
        id: r.storyId as string,
        name: r.name,
        email: r.email,
        detail: r.storyTitle,
      }));

  const selectedRecipients = (recipients ?? []).filter(
    (r) => !excluded.has(r.id),
  );

  const blocked =
    status !== undefined && (!status.emailsEnabled || !status.typeEnabled);
  const canCompose = subject.trim() !== "" && body.trim() !== "";

  // Rolling 24h cap from the server: recipients still available today
  const remaining =
    status !== undefined
      ? Math.max(0, status.dailyCap - status.usedLast24h)
      : undefined;
  const overCap =
    remaining !== undefined && selectedRecipients.length > remaining;

  // datetime-local wants "YYYY-MM-DDTHH:mm" in local time
  const toLocalInputValue = (ms: number) => {
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const template = templates?.find((t) => t._id === id);
    if (template) {
      setSubject(template.subject);
      setBody(template.body);
      setSignature(template.signature ?? "");
    }
  };

  const changeAudience = (next: RecipientAudience) => {
    setAudience(next);
    setExcluded(new Set());
    setPreviewRecipientId("");
    setFeedback(null);
  };

  const toggleRecipient = (id: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (!recipients) return;
    setExcluded((prev) =>
      prev.size === 0 ? new Set(recipients.map((r) => r.id)) : new Set(),
    );
  };

  const handleSendTest = async () => {
    setIsSending(true);
    setFeedback(null);
    try {
      const result = await sendGroupTestEmail({
        groupId: group._id,
        subject,
        body,
        signature: signature.trim() || undefined,
        replyTo: replyTo.trim() || undefined,
        templateId: (templateId || undefined) as
          | Id<"emailTemplates">
          | undefined,
      });
      setFeedback({
        kind: "success",
        text: `Test email queued to ${result.sentTo}.`,
      });
    } catch (error) {
      setFeedback({
        kind: "error",
        text:
          error instanceof Error ? error.message : "Failed to send test email",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = async () => {
    setIsSending(true);
    setFeedback(null);
    try {
      const scheduledAtMs = scheduleAt
        ? new Date(scheduleAt).getTime()
        : undefined;
      const result = await sendGroupEmail({
        groupId: group._id,
        subject,
        body,
        signature: signature.trim() || undefined,
        replyTo: replyTo.trim() || undefined,
        recipientType: audience,
        judgeIds: isJudges
          ? selectedRecipients.map((r) => r.id as Id<"judges">)
          : undefined,
        storyIds: !isJudges
          ? selectedRecipients.map((r) => r.id as Id<"stories">)
          : undefined,
        templateId: (templateId || undefined) as
          | Id<"emailTemplates">
          | undefined,
        scheduledAtMs,
      });
      const countLabel = `${result.totalRecipients} ${result.totalRecipients === 1 ? audienceNoun : audienceNounPlural}`;
      if (result.scheduledFor !== undefined) {
        setScheduleAt("");
        setFeedback({
          kind: "success",
          text: `Email scheduled for ${new Date(result.scheduledFor).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} to ${countLabel}. You can cancel it below before it sends.`,
        });
      } else {
        setFeedback({
          kind: "success",
          text: `Email queued to ${countLabel}.`,
        });
      }
    } catch (error) {
      setFeedback({
        kind: "error",
        text: error instanceof Error ? error.message : "Failed to send email",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleCancelScheduled = async () => {
    if (!cancelTarget) return;
    try {
      await cancelScheduledEmail({
        groupId: group._id,
        scheduledEmailId: cancelTarget,
      });
      setFeedback({ kind: "success", text: "Scheduled email cancelled." });
    } catch (error) {
      setFeedback({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to cancel scheduled email",
      });
    } finally {
      setCancelTarget(null);
    }
  };

  // Preview substitutes a real selected recipient (pickable, defaults to the
  // first) so the organizer sees exactly what that person receives.
  const previewRecipient =
    selectedRecipients.find((r) => r.id === previewRecipientId) ??
    selectedRecipients[0];
  const previewVars = {
    firstname: previewRecipient
      ? previewRecipient.name.trim().split(/\s+/)[0] || "there"
      : "Ada",
    name: previewRecipient?.name ?? "Ada Lovelace",
    email: previewRecipient?.email ?? "ada@example.com",
    groupname: group.name,
    // Real group links, same builder the backend uses at send time
    ...judgingGroupUrls(group.slug),
  };
  const previewHtml = templateEmailShell(
    renderMarkdownLite(applyTemplateVars(body, previewVars)),
    signature.trim()
      ? renderMarkdownLite(applyTemplateVars(signature, previewVars))
      : undefined,
  );

  const emptyRecipientsCopy = isJudges
    ? "No judges in this group registered with an email address, so there is nobody to send to yet."
    : "No submission owners in this group have an email address, so there is nobody to send to yet.";

  return (
    <div className="space-y-4">
      {/* Toggle status banner */}
      {blocked && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-md text-[13px]">
          {status && !status.emailsEnabled
            ? "The global email system is turned off, so nothing can send."
            : "Judging group emails are turned off."}{" "}
          An admin can enable them in Admin, Email Management, Email Send
          Options.
        </div>
      )}

      <SectionCard
        title={`Email ${audienceNounPlural}`}
        description={`Send an email to this group's ${audienceNounPlural}. Start from a template or write from scratch. Bodies support basic markdown and per-recipient variables.`}
      >
        {/* Audience: judges or submission owners */}
        <div>
          <label
            htmlFor="group-email-audience"
            className="block text-[13px] font-medium text-copy mb-1"
          >
            Send to
          </label>
          <SimpleSelect
            id="group-email-audience"
            value={audience}
            onChange={(value) => changeAudience(value as RecipientAudience)}
            disabled={isSending}
            className="w-full max-w-md h-auto py-2 text-sm"
            options={[
              { value: "judges", label: "Judges" },
              { value: "submission_owners", label: "Submission owners" },
            ]}
          />
          <p className="text-xs text-soft mt-1">
            {isJudges
              ? "Judges who registered for this group with an email address."
              : "Owners of submissions in this group. Account email is used when available; duplicates are sent once."}
          </p>
        </div>

        {/* Template picker */}
        <div>
          <label
            htmlFor="group-email-template"
            className="block text-[13px] font-medium text-copy mb-1"
          >
            Template
          </label>
          <SimpleSelect
            id="group-email-template"
            value={templateId}
            onChange={(value) => applyTemplate(value)}
            disabled={isSending}
            className="w-full max-w-md h-auto py-2 text-sm"
            options={[
              { value: "", label: "Write from scratch" },
              ...(templates ?? []).map((template) => ({
                value: template._id as string,
                label: template.name,
              })),
            ]}
          />
          <p className="text-xs text-soft mt-1">
            Picking a template fills the fields below; edits here only affect
            this send. Templates are managed in Admin, Email Management,
            Templates.
          </p>
        </div>

        {/* Subject */}
        <div>
          <label
            htmlFor="group-email-subject"
            className="block text-[13px] font-medium text-copy mb-1"
          >
            Subject
          </label>
          <input
            id="group-email-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. {{groupname}} judging starts today"
            disabled={isSending}
            className="w-full px-3 py-2 text-sm border border-hairline rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-hairline-strong focus:border-transparent"
          />
        </div>

        {/* Body */}
        <div>
          <label
            htmlFor="group-email-body"
            className="block text-[13px] font-medium text-copy mb-1"
          >
            Body (markdown)
          </label>
          <textarea
            id="group-email-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder={
              isJudges
                ? `Hi {{firstname}},\n\nJudging for **{{groupname}}** is open.\n\n- Review your assigned submissions\n- Score each criteria`
                : `Hi {{firstname}},\n\nThanks for submitting to **{{groupname}}**.\n\n- Keep an eye on {{resultsurl}}\n- Reply here if you have questions`
            }
            disabled={isSending}
            className="w-full px-3 py-2 text-sm border border-hairline rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-hairline-strong focus:border-transparent font-mono"
          />
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-soft mr-1">Variables:</span>
            {TEMPLATE_VARIABLES.map((variable) => (
              <code
                key={variable.key}
                title={variable.description}
                className="text-xs text-copy bg-surface-alt border border-hairline rounded px-1.5 py-0.5 font-mono"
              >
                {`{{${variable.key}}}`}
              </code>
            ))}
          </div>
        </div>

        {/* Signature */}
        <div>
          <label
            htmlFor="group-email-signature"
            className="block text-[13px] font-medium text-copy mb-1"
          >
            Signature (optional)
          </label>
          <textarea
            id="group-email-signature"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            rows={3}
            placeholder={`**The organizing team**\n[vibeapps.dev](https://vibeapps.dev)`}
            disabled={isSending}
            className="w-full px-3 py-2 text-sm border border-hairline rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-hairline-strong focus:border-transparent font-mono"
          />
        </div>

        {/* Reply-to */}
        <div>
          <label
            htmlFor="group-email-replyto"
            className="block text-[13px] font-medium text-copy mb-1"
          >
            Reply-to address (optional)
          </label>
          <input
            id="group-email-replyto"
            type="email"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
            list="group-email-replyto-options"
            placeholder="organizer@example.com"
            disabled={isSending}
            className="w-full max-w-md px-3 py-2 text-sm border border-hairline rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-hairline-strong focus:border-transparent"
          />
          <datalist id="group-email-replyto-options">
            {(group.notificationEmails ?? []).map((email) => (
              <option key={email} value={email} />
            ))}
          </datalist>
          <p className="text-xs text-soft mt-1">
            Replies go to this address. Blank means replies go to the default
            from address. Group notification emails are suggested.
          </p>
        </div>

        {/* Recipients */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="block text-[13px] font-medium text-copy">
              Recipients ({selectedRecipients.length} of{" "}
              {recipients?.length ?? 0} {audienceNounPlural} with an email)
            </span>
            {recipients !== undefined && recipients.length > 0 && (
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs font-medium text-copy hover:text-ink transition-colors"
              >
                {excluded.size === 0 ? "Deselect all" : "Select all"}
              </button>
            )}
          </div>
          {recipients === undefined ? (
            <p className="text-xs text-soft">
              Loading {audienceNounPlural}...
            </p>
          ) : recipients.length === 0 ? (
            <p className="text-xs text-soft">{emptyRecipientsCopy}</p>
          ) : (
            <div className="max-h-48 overflow-y-auto rounded-md border border-hairline divide-y divide-hairline">
              {recipients.map((recipient) => (
                <label
                  key={recipient.id}
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-surface-hover"
                >
                  <input
                    type="checkbox"
                    checked={!excluded.has(recipient.id)}
                    onChange={() => toggleRecipient(recipient.id)}
                    disabled={isSending}
                    className="h-4 w-4 rounded border-hairline-strong text-ink focus:ring-hairline-strong"
                  />
                  <span className="text-[13px] text-ink shrink-0">
                    {recipient.name}
                  </span>
                  <span className="text-xs text-soft truncate">
                    {recipient.email}
                    {recipient.detail ? ` · ${recipient.detail}` : ""}
                  </span>
                </label>
              ))}
            </div>
          )}
          {status !== undefined && (
            <p
              className={`text-xs mt-1 ${overCap ? "text-red-600" : "text-soft"}`}
            >
              Daily limit: {status.usedLast24h} of {status.dailyCap} recipient
              emails used in the last 24 hours
              {overCap
                ? `. Only ${remaining} remaining, so deselect some recipients or wait.`
                : "."}
            </p>
          )}
        </div>

        {/* Schedule */}
        <div>
          <label
            htmlFor="group-email-schedule"
            className="block text-[13px] font-medium text-copy mb-1"
          >
            Send time (optional)
          </label>
          <input
            id="group-email-schedule"
            type="datetime-local"
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
            min={toLocalInputValue(Date.now() + 5 * 60 * 1000)}
            disabled={isSending}
            className="w-full max-w-md px-3 py-2 text-sm border border-hairline rounded-md bg-surface focus:outline-none focus:ring-2 focus:ring-hairline-strong focus:border-transparent"
          />
          <p className="text-xs text-soft mt-1">
            Blank sends immediately. Scheduled sends appear below and can be
            cancelled any time before they fire.
          </p>
        </div>

        {/* Feedback */}
        {feedback && (
          <div
            className={`p-3 rounded-md text-[13px] ${
              feedback.kind === "success"
                ? "bg-green-50 border border-green-200 text-green-800"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={
              isSending ||
              blocked ||
              !canCompose ||
              overCap ||
              selectedRecipients.length === 0
            }
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-md bg-cta text-on-cta hover:bg-cta-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            {isSending
              ? "Sending..."
              : `${scheduleAt ? "Schedule for" : "Send to"} ${selectedRecipients.length} ${selectedRecipients.length === 1 ? audienceNoun : audienceNounPlural}`}
          </button>
          <button
            type="button"
            onClick={() => void handleSendTest()}
            disabled={isSending || blocked || !canCompose}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-md text-copy bg-surface-alt hover:bg-surface-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Mail className="w-4 h-4" />
            Send test to me
          </button>
          <button
            type="button"
            onClick={() => setShowPreview((prev) => !prev)}
            disabled={!canCompose}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-md text-copy hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            <Eye className="w-4 h-4" />
            {showPreview ? "Hide preview" : "Preview"}
          </button>
        </div>

        {showPreview && canCompose && (
          <div className="border border-hairline rounded-md overflow-hidden">
            <div className="px-4 py-2 bg-surface-alt border-b border-hairline text-xs text-copy flex items-center gap-2 flex-wrap">
              <span>Preview as</span>
              {selectedRecipients.length > 1 ? (
                <SimpleSelect
                  value={previewRecipient?.id ?? ""}
                  onChange={(value) => setPreviewRecipientId(value)}
                  aria-label={`Preview as ${audienceNoun}`}
                  className="w-auto h-auto px-2 py-1 text-xs gap-1"
                  options={selectedRecipients.map((recipient) => ({
                    value: recipient.id,
                    label: recipient.name,
                  }))}
                />
              ) : (
                <span className="font-medium">{previewVars.name}</span>
              )}
              <span>: subject "{applyTemplateVars(subject, previewVars)}"</span>
            </div>
            <iframe
              title="Email preview"
              srcDoc={previewHtml}
              className="w-full h-96 bg-surface"
              sandbox=""
            />
          </div>
        )}
      </SectionCard>

      {/* Scheduled sends waiting to fire */}
      {scheduledSends !== undefined && scheduledSends.length > 0 && (
        <SectionCard
          title="Scheduled sends"
          description="Queued emails that have not fired yet. Cancel any of them before the send time."
        >
          <div className="rounded-md border border-hairline divide-y divide-hairline">
            {scheduledSends.map((row) => (
              <div
                key={row._id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-[13px] text-ink truncate">
                    {row.subject}
                  </p>
                  <p className="text-xs text-soft">
                    {new Date(row.scheduledFor).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}{" "}
                    · {row.recipientCount} recipient
                    {row.recipientCount === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCancelTarget(row._id)}
                  className="px-3 py-1.5 text-xs font-medium rounded-md text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Recent sends with per-send delivery stats */}
      <SectionCard
        title="Recent sends"
        description="Delivery stats per send. Opens and bounces come from the Resend webhook, so counts fill in as events arrive."
      >
        {recentSends === undefined ? (
          <p className="text-xs text-soft">Loading...</p>
        ) : recentSends.length === 0 ? (
          <p className="text-xs text-soft">No emails sent yet.</p>
        ) : (
          <div className="rounded-md border border-hairline divide-y divide-hairline">
            {recentSends.map((send) => {
              const problems = send.bounced + send.failed + send.complained;
              return (
                <div
                  key={send.sendId}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] text-ink truncate">
                      {send.subject ?? "(no subject recorded)"}
                      {send.isTest && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-faint">
                          test
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-soft truncate">
                      to {send.total} recipient{send.total === 1 ? "" : "s"} ·{" "}
                      {new Date(send.sentAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                      {send.delivered}/{send.total} delivered
                    </span>
                    {send.opened > 0 && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-surface-alt text-copy">
                        {send.opened} opened
                      </span>
                    )}
                    {problems > 0 && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">
                        {problems} bounced/failed
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <AlertDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          void handleSend();
        }}
        title={
          scheduleAt
            ? `Schedule email to ${audienceNounPlural}`
            : `Send email to ${audienceNounPlural}`
        }
        description={
          scheduleAt
            ? `This schedules "${subject.trim()}" to ${selectedRecipients.length} ${selectedRecipients.length === 1 ? audienceNoun : audienceNounPlural} in ${group.name} for ${new Date(scheduleAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}. You can cancel it from Scheduled sends before it fires.`
            : `This sends "${subject.trim()}" to ${selectedRecipients.length} ${selectedRecipients.length === 1 ? audienceNoun : audienceNounPlural} in ${group.name}. Send a test to yourself first if you have not checked the rendering.`
        }
        confirmButtonText={
          scheduleAt
            ? `Schedule for ${selectedRecipients.length}`
            : `Send to ${selectedRecipients.length}`
        }
      />

      <AlertDialog
        isOpen={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => void handleCancelScheduled()}
        title="Cancel scheduled email"
        description="This stops the scheduled send before it fires. Nothing is emailed and the queued send is removed."
        confirmButtonText="Cancel send"
      />
    </div>
  );
}
