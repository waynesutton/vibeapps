import { useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Globe,
  KeyRound,
  Lock,
} from "lucide-react";
import { GroupDetails, SectionCard } from "./groupSection";

// One entry in the links ledger; rows and the markdown export both render
// from this shape so they never drift apart. Exported so other sections
// (e.g. the AI judge settings card) can render the same rows.
export type LinkEntry = {
  label: string;
  url: string;
  locked: boolean;
  passwordSet: boolean;
  keyRequired?: boolean;
  note: string;
  // Plaintext password included only in the markdown event kit export so
  // organizers get links and access codes in one paste. Never rendered in
  // the on-screen ledger rows.
  password?: string;
};

// Stored passwords are SHA-256 hex (see hashPassword in
// convex/judgingGroups.ts). Older rows used reversible btoa; decode those
// so the admin-only event kit export can still include the access code.
function decodeStoredPassword(
  encoded: string | undefined,
): string | undefined {
  if (!encoded) return undefined;
  // SHA-256 hex is 64 lowercase hex chars and cannot be reversed
  if (/^[0-9a-f]{64}$/.test(encoded)) return undefined;
  try {
    const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return undefined;
  }
}

// Real-time links ledger for one judging group. Every shareable URL in one
// place with a lock icon when it is password protected and a live "password
// set" status. The group document streams from Convex, so lock states update
// the moment another admin changes a password or visibility toggle.
export function GroupLinksSection({ group }: { group: GroupDetails }) {
  // Agent judging API lives on the Convex site domain, not the app domain
  const convexSiteUrl = (
    (import.meta.env.VITE_CONVEX_URL as string | undefined) ?? ""
  ).replace(".convex.cloud", ".convex.site");
  // AI judge links (AI results page and agent API) only exist while the AI
  // judge is enabled; disabling it hides them everywhere.
  const aiJudgeOn = !!group.aiJudgeEnabled;
  const agentApiEnabled = aiJudgeOn && group.agentKeysEnabled !== false;

  const shareLinks: Array<LinkEntry> = [
    {
      label: "Judging interface",
      url: `${window.location.origin}/judging/${group.slug}`,
      locked: !group.isPublic,
      passwordSet: group.hasJudgePassword,
      note: group.isPublic
        ? "Public: anyone with the link can judge"
        : "Private: judges enter the judge password",
      password: !group.isPublic
        ? decodeStoredPassword(group.judgePassword)
        : undefined,
    },
    {
      label: "Results page",
      url: `${window.location.origin}/judging/${group.slug}/results`,
      locked: !(group.resultsIsPublic ?? false),
      passwordSet: !!group.resultsPassword,
      note: (group.resultsIsPublic ?? false)
        ? "Public: anyone with the link sees rankings"
        : "Private: visitors enter the results password",
      password: !(group.resultsIsPublic ?? false)
        ? decodeStoredPassword(group.resultsPassword)
        : undefined,
    },
    ...(group.hasCustomSubmissionPage
      ? [
          {
            label: "Custom submission page",
            url: `${window.location.origin}/judging/${group.slug}/submit`,
            locked: group.hasSubmissionPagePassword,
            passwordSet: group.hasSubmissionPagePassword,
            note: group.hasSubmissionPagePassword
              ? "Participants enter the submission password"
              : "Open: anyone with the link can submit",
            password: decodeStoredPassword(group.submissionPagePassword),
          },
        ]
      : []),
    ...(aiJudgeOn
      ? [
          {
            label: "AI results page",
            url: `${window.location.origin}/judging/${group.slug}/ai-results`,
            locked: !(group.aiResultsIsPublic ?? false),
            passwordSet: group.hasAiResultsPassword,
            note: (group.aiResultsIsPublic ?? false)
              ? "Public: anyone with the link sees AI scores"
              : "Private: visitors enter the AI results password",
            password: !(group.aiResultsIsPublic ?? false)
              ? decodeStoredPassword(group.aiResultsPassword)
              : undefined,
          },
        ]
      : []),
  ];

  const agentLinks: Array<LinkEntry> = agentApiEnabled
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
    : [];

  // Markdown export of every link with its access state, ready to paste
  // into event docs or share with organizers. Locked links include their
  // access code so the export works as a complete event kit.
  const buildMarkdown = () => {
    const entryLines = (entry: LinkEntry) => {
      const access = entry.keyRequired
        ? "Agent key required"
        : entry.locked
          ? `Password protected (${entry.passwordSet ? "password set" : "no password set yet"})`
          : "Public";
      const lines = [
        `- **${entry.label}**: ${entry.url}`,
        `  - ${access}. ${entry.note}`,
      ];
      if (entry.locked && !entry.keyRequired && entry.password) {
        lines.push(`  - Password: ${entry.password}`);
      }
      return lines;
    };
    const lines = [
      `# ${group.name} judging links`,
      "",
      "## Shareable links",
      "",
      ...shareLinks.flatMap(entryLines),
    ];
    if (!group.hasCustomSubmissionPage) {
      lines.push(
        "",
        "Note: this group has no shareable submission link yet. Enable the custom submission page in the Submit page section to get one.",
      );
    }
    if (aiJudgeOn) {
      lines.push(
        "",
        `Score scales: human judges score 1 to ${group.scoreScale}; the AI judge always scores 1 to 10.`,
      );
    }
    if (agentLinks.length > 0) {
      lines.push("", "## Agent API", "", ...agentLinks.flatMap(entryLines));
    }
    return lines.join("\n") + "\n";
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title="Shareable links"
        description="Every link this group exposes. Locked links ask for a password; this list updates in real time as settings change. Copy all and the .md download include any set passwords so organizers get everything in one paste."
        headerAction={<LinksExportActions groupSlug={group.slug} buildMarkdown={buildMarkdown} />}
      >
        <div className="space-y-2">
          {shareLinks.map((entry) => (
            <LinkLedgerRow key={entry.label} {...entry} />
          ))}
        </div>
        {!group.hasCustomSubmissionPage && (
          <p className="text-xs text-soft mt-3">
            Want a shareable submission link for participants? Enable the
            custom submission page in the Submit page section and it will
            appear here.
          </p>
        )}
        {aiJudgeOn && (
          <p className="text-xs text-soft mt-3">
            Score scales differ: human judges score 1 to {group.scoreScale};
            the AI judge always scores 1 to 10.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Agent API"
        description="Endpoints external AI agents call with an x-judge-key header. Keys are managed in the AI judge section."
      >
        {agentApiEnabled ? (
          <div className="space-y-2">
            {agentLinks.map((entry) => (
              <LinkLedgerRow key={entry.label} {...entry} />
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-soft">
            {aiJudgeOn
              ? "The agent API is disabled for this group. Enable it in the AI judge section to share these endpoints."
              : "The AI judge is off, so no AI judge links exist for this group. Enable the AI judge to activate the AI results page and agent API."}
          </p>
        )}
      </SectionCard>
    </div>
  );
}

// Copy-all and markdown download actions for the links ledger. Both export
// the same markdown built from the live link entries.
function LinksExportActions({
  groupSlug,
  buildMarkdown,
}: {
  groupSlug: string;
  buildMarkdown: () => string;
}) {
  const [copiedAll, setCopiedAll] = useState(false);

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(buildMarkdown());
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      // Clipboard unavailable; the download button still works
    }
  };

  const handleDownload = () => {
    const blob = new Blob([buildMarkdown()], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${groupSlug}-links.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => void handleCopyAll()}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-hairline text-copy hover:bg-surface-hover transition-colors"
        title="Copy all links as markdown"
      >
        {copiedAll ? (
          <Check className="w-3.5 h-3.5 text-green-600" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
        {copiedAll ? "Copied" : "Copy all"}
      </button>
      <button
        type="button"
        onClick={handleDownload}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-hairline text-copy hover:bg-surface-hover transition-colors"
        title="Download all links as a markdown file"
      >
        <Download className="w-3.5 h-3.5" />
        .md
      </button>
    </div>
  );
}

// One ledger row: lock/globe status icon, URL, live password state, and
// copy/open actions. Exported for reuse in the AI judge settings card.
export function LinkLedgerRow({
  label,
  url,
  locked,
  passwordSet,
  keyRequired,
  note,
}: LinkEntry) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable; the URL stays visible for manual copy
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-md border border-hairline bg-surface">
      <div className="min-w-0 flex items-start gap-2.5">
        {keyRequired ? (
          <KeyRound className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        ) : locked ? (
          <Lock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        ) : (
          <Globe className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
        )}
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-ink">
            {label}
            {locked && !keyRequired && (
              <span
                className={`ml-2 text-xs font-normal ${
                  passwordSet ? "text-amber-700" : "text-red-600"
                }`}
              >
                {passwordSet ? "Password set" : "No password set"}
              </span>
            )}
            {keyRequired && (
              <span className="ml-2 text-xs font-normal text-amber-700">
                Key required
              </span>
            )}
          </p>
          <p className="text-xs text-soft truncate font-mono">{url}</p>
          <p className="text-xs text-faint mt-0.5">{note}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="p-1.5 text-faint hover:text-copy hover:bg-surface-hover rounded transition-colors"
          title="Copy URL"
          aria-label={`Copy ${label} URL`}
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 text-faint hover:text-copy hover:bg-surface-hover rounded transition-colors"
          title="Open in new tab"
          aria-label={`Open ${label} in new tab`}
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
