import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import {
  ArrowLeft,
  ArrowUpRight,
  Bot,
  CalendarClock,
  Check,
  Copy,
  ListChecks,
  Lock,
  PauseCircle,
  Star,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Markdown } from "../components/Markdown";
import { NotFoundPage } from "./NotFoundPage";
import {
  ACCESS_CODE_PLACEHOLDER,
  accessCodeNote,
  aiReviewParagraphs,
  deadlineText,
  judgingLinks,
  judgingUrl,
  queueSummary,
  ratingAnchors,
  scaleSummary,
  showAiResultsLink,
  tldrSteps,
  TROUBLESHOOTING,
  type HowToJudgeData,
  type HowToJudgeLink,
} from "../lib/howToJudgeMarkdown";

/**
 * Public one sheet for judges at /judging/{slug}/howtojudge. Reads live
 * group data so links, criteria, scale, deadline, and queue size are always
 * current. Never shows a passcode: the access code area renders the
 * organizer's placeholder (default "passcodegoeshere") and the real code is
 * sent by Slack or email. Organizers edit the extra fields from the group
 * workspace and can export the same content as Markdown for Google Docs.
 */

type Section = { id: string; label: string };

// Generic screenshots captured from a demo group. Missing files hide
// themselves so a stale filename never leaves a broken image.
function Shot({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <figure className="mt-4 overflow-hidden rounded-lg border border-hairline bg-surface-alt">
      <img
        src={`/docs/judging/${src}`}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="block w-full"
        onError={() => setFailed(true)}
      />
      <figcaption className="border-t border-hairline px-3 py-2 text-xs text-soft">
        {caption}
      </figcaption>
    </figure>
  );
}

// The access code chip: literal placeholder, never the real code
function AccessCodeChip({ value }: { value: string }) {
  return (
    <code className="inline-flex items-center gap-1.5 rounded-md border border-hairline-strong bg-surface-alt px-2 py-0.5 font-mono text-[13px] text-ink">
      <Lock className="h-3 w-3 text-soft" aria-hidden="true" />
      {value}
    </code>
  );
}

function LinkRow({ link }: { link: HowToJudgeLink }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked in some embeds; the link is still clickable
    }
  };
  return (
    <li className="flex items-start gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex max-w-full items-center gap-1 text-sm font-medium text-ink hover:underline"
        >
          <span className="truncate">{link.label}</span>
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-soft" aria-hidden="true" />
        </a>
        <p className="truncate font-mono text-xs text-soft">{link.url}</p>
        {link.note && <p className="mt-0.5 text-xs text-copy">{link.note}</p>}
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${link.label} link`}
        className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-hairline text-soft transition-colors hover:bg-surface-hover hover:text-ink"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </li>
  );
}

function LinksCard({
  links,
  title,
}: {
  links: Array<HowToJudgeLink>;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-surface p-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-soft">{title}</h3>
      <ul className="mt-1 divide-y divide-hairline">
        {links.map((link) => (
          <LinkRow key={link.url} link={link} />
        ))}
      </ul>
    </div>
  );
}

function SectionHeading({
  id,
  children,
  eyebrow,
}: {
  id: string;
  children: string;
  eyebrow?: string;
}) {
  return (
    <div id={id} className="scroll-mt-24 pt-10">
      {eyebrow && (
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-soft">{eyebrow}</p>
      )}
      <h2 className="text-xl font-medium tracking-tight text-ink">{children}</h2>
    </div>
  );
}

// Sticky section nav: left rail on desktop, scrolling tabs on mobile.
// Active state follows scroll position with one IntersectionObserver.
function SectionNav({ sections }: { sections: Array<Section> }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");
  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav aria-label="Sections" className="lg:sticky lg:top-24">
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
        {sections.map((s) => {
          const isActive = s.id === active;
          return (
            <li key={s.id} className="shrink-0">
              <a
                href={`#${s.id}`}
                aria-current={isActive ? "location" : undefined}
                className={`block whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm transition-colors lg:whitespace-normal ${
                  isActive
                    ? "bg-surface-alt font-medium text-ink"
                    : "text-soft hover:bg-surface-hover hover:text-ink"
                }`}
              >
                {s.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Prose({ children }: { children: string }) {
  return (
    <div className="prose prose-sm max-w-none text-copy prose-headings:text-ink prose-a:text-ink prose-strong:text-ink">
      <Markdown>{children}</Markdown>
    </div>
  );
}

export default function HowToJudgePage() {
  const { slug } = useParams<{ slug: string }>();
  const data = useQuery(
    api.judgingGroups.getHowToJudgePage,
    slug ? { slug } : "skip",
  );
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  if (data === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-hairline-strong border-t-ink" />
          <p className="text-copy">Loading the judging guide...</p>
        </div>
      </div>
    );
  }
  if (data === null) return <NotFoundPage />;

  return <HowToJudgeDocument data={data} origin={origin} />;
}

function HowToJudgeDocument({
  data,
  origin,
}: {
  data: HowToJudgeData;
  origin: string;
}) {
  const links = useMemo(() => judgingLinks(data, origin), [data, origin]);
  const steps = useMemo(() => tldrSteps(data, origin), [data, origin]);
  const ai = useMemo(() => aiReviewParagraphs(data, origin), [data, origin]);
  const deadline = deadlineText(data);
  const settings = data.howToJudge;
  const code = accessCodeNote(data);
  const queueCount =
    data.judgeQueueMode === "shortlist" ? data.shortlistCount : data.submissionCount;

  const hasOrganizerBlocks =
    !!settings?.privateRepoNote?.trim() ||
    !!settings?.assignments?.trim() ||
    !!settings?.notes?.trim() ||
    !!settings?.contact?.trim();

  const sections: Array<Section> = useMemo(() => {
    const list: Array<Section> = [
      { id: "tldr", label: "TL;DR" },
      { id: "getting-in", label: "Getting in" },
      { id: "queue", label: "Your queue" },
      { id: "criteria", label: "Scoring criteria" },
      { id: "status", label: "Status and finishing" },
      { id: "submission", label: "What you will see" },
    ];
    if (ai.length > 0) list.push({ id: "ai-review", label: "AI review" });
    list.push({ id: "navigation", label: "Finding your way" });
    list.push({ id: "troubleshooting", label: "Troubleshooting" });
    if (hasOrganizerBlocks) list.push({ id: "organizer", label: "From the organizer" });
    list.push({ id: "links", label: "Links" });
    return list;
  }, [ai.length, hasOrganizerBlocks]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6">
      {/* Header */}
      <header className="border-b border-hairline pb-6">
        <Link
          to={`/judging/${data.slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-soft transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {data.name}
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              data.isActive
                ? "border-hairline bg-surface-alt text-ink"
                : "border-hairline bg-surface-alt text-soft"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${data.isActive ? "bg-green-600" : "bg-faint"}`}
              aria-hidden="true"
            />
            {data.isActive ? "Judging open" : "Judging paused"}
          </span>
          {deadline && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface-alt px-2.5 py-0.5 text-xs text-copy">
              <CalendarClock className="h-3.5 w-3.5 text-soft" aria-hidden="true" />
              Deadline {deadline}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface-alt px-2.5 py-0.5 text-xs text-copy">
            <ListChecks className="h-3.5 w-3.5 text-soft" aria-hidden="true" />
            {queueCount} submission{queueCount === 1 ? "" : "s"} to judge
          </span>
          {data.aiJudgeEnabled && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface-alt px-2.5 py-0.5 text-xs text-copy">
              <Bot className="h-3.5 w-3.5 text-soft" aria-hidden="true" />
              AI review on
            </span>
          )}
        </div>
        <h1 className="mt-4 text-3xl font-medium tracking-tight text-ink sm:text-4xl">
          How to judge
        </h1>
        <p className="mt-2 max-w-2xl text-base text-copy">
          {data.description?.trim() ||
            `Everything you need to log in, score, and finish judging ${data.name}. This page updates live, so bookmark it instead of a copy.`}
        </p>
        {!data.isActive && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-hairline bg-surface-alt p-3 text-sm text-copy">
            <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-soft" aria-hidden="true" />
            <p>
              Judging is paused right now. You can read ahead, and the judging link will work
              again once the organizer reopens it. Saved scores are kept.
            </p>
          </div>
        )}
      </header>

      <div className="mt-6 grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        {/* Section nav: tabs on mobile, rail on desktop */}
        <div className="sticky top-16 z-10 -mx-4 border-b border-hairline bg-canvas px-4 py-2 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
          <SectionNav sections={sections} />
        </div>

        <article className="min-w-0 max-w-3xl">
          {/* Links at the top */}
          <LinksCard links={links} title="Links you need" />

          {/* TL;DR */}
          <SectionHeading id="tldr" eyebrow="Short version">
            TL;DR
          </SectionHeading>
          <ol className="mt-4 space-y-3 rounded-lg border border-hairline bg-surface p-4">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-copy">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cta font-mono text-xs font-medium text-on-cta">
                  {i + 1}
                </span>
                <span className="pt-0.5">
                  {step.includes(code) && data.hasJudgePassword ? (
                    <>
                      Enter the access code <AccessCodeChip value={code} /> (your organizer sends
                      the real code by Slack or email).
                    </>
                  ) : step.startsWith("Open the judging link") ? (
                    <>
                      Open the judging link:{" "}
                      <a
                        href={judgingUrl(data, origin)}
                        className="font-medium text-ink underline underline-offset-2"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {judgingUrl(data, origin)}
                      </a>
                    </>
                  ) : (
                    step
                  )}
                </span>
              </li>
            ))}
          </ol>

          {/* Getting in */}
          <SectionHeading id="getting-in" eyebrow="Step by step">
            Getting in
          </SectionHeading>
          <div className="mt-3 space-y-3 text-sm text-copy">
            <p>
              Open{" "}
              <a
                href={judgingUrl(data, origin)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-ink underline underline-offset-2"
              >
                the judging link
              </a>
              . {data.hasJudgePassword ? "You will see an access code screen first." : "No access code is needed for this group."}
            </p>
            {data.hasJudgePassword && (
              <>
                <p>
                  Enter the access code <AccessCodeChip value={code} />. Your organizer sends the
                  real code by Slack or email. Codes are case sensitive, so paste it with no
                  spaces, and never post it publicly.
                </p>
                <Shot
                  src="access-code.png"
                  alt="The access code screen for a judging group"
                  caption="The access code screen. The code itself is never shown on this guide."
                />
              </>
            )}
            <p>
              Type your first name. The field only accepts lowercase letters, and that name labels
              every score you give. Email is optional. Coming back later? Use the exact same name
              and your progress is waiting for you.
            </p>
            <Shot
              src="judge-name.png"
              alt="The judge name form asking for a lowercase first name"
              caption="Use the same first name every time so your scores stay together."
            />
          </div>

          {/* Your queue */}
          <SectionHeading id="queue" eyebrow="What you are judging">
            Your queue
          </SectionHeading>
          <div className="mt-3 space-y-3 text-sm text-copy">
            <p>{queueSummary(data)}</p>
            {data.judgeQueueMode === "shortlist" && (
              <div className="flex items-start gap-2 rounded-lg border border-hairline bg-surface-alt p-3">
                <Star className="mt-0.5 h-4 w-4 shrink-0 text-soft" aria-hidden="true" />
                <p>
                  Shortlist round. {data.shortlistCount} of {data.submissionCount} submissions
                  made the cut. Judge only what appears in your queue.
                </p>
              </div>
            )}
            <Shot
              src="judging-interface.png"
              alt="The submission card with the position counter, search and filters, status row, and project links"
              caption="The submission card. Counter and filters on top, status and project links below. Scoring sits in the right column."
            />
          </div>

          {/* Criteria */}
          <SectionHeading id="criteria" eyebrow="Live from this group">
            Scoring criteria
          </SectionHeading>
          <p className="mt-3 text-sm text-copy">{scaleSummary(data)}</p>
          {data.criteria.length > 0 ? (
            <ol className="mt-4 divide-y divide-hairline rounded-lg border border-hairline bg-surface">
              {data.criteria.map((c, i) => (
                <li key={c._id} className="flex gap-3 p-4">
                  <span className="font-mono text-xs text-faint">{String(i + 1).padStart(2, "0")}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{c.question}</p>
                    {c.description?.trim() && (
                      <p className="mt-1 text-sm text-copy">{c.description.trim()}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-hairline-strong p-4 text-sm text-soft">
              Criteria have not been published yet. Check back before you start.
            </p>
          )}
          <div className="mt-4 rounded-lg border border-hairline bg-surface-alt p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-soft">Rating guide</p>
            <dl className="mt-2 grid gap-2 sm:grid-cols-2">
              {ratingAnchors(data.scoreScale).map((a) => (
                <div key={a.range} className="flex gap-3 text-sm">
                  <dt className="w-14 shrink-0 font-mono text-ink">{a.range}</dt>
                  <dd className="text-copy">{a.meaning}</dd>
                </div>
              ))}
            </dl>
          </div>
          <Shot
            src="scoring-row.png"
            alt="A criterion with its score buttons and an optional comment box"
            caption="Pick a number for each criterion. Comments are optional and save with the score."
          />

          {/* Status */}
          <SectionHeading id="status" eyebrow="Finishing a submission">
            Status and finishing
          </SectionHeading>
          <ul className="mt-3 space-y-2 text-sm text-copy">
            <li>
              <span className="font-medium text-ink">Pending</span>: not started or in progress.
              Scores save the moment you pick a number.
            </li>
            <li>
              <span className="font-medium text-ink">Completed</span>: every criterion scored and
              you pressed Mark Complete or Judged & Next.
            </li>
            <li>
              <span className="font-medium text-ink">Skip</span>: use when a submission is not
              eligible or you have a conflict of interest, and say why in a note.
            </li>
            <li>
              <span className="font-medium text-ink">Edit Scores</span> reopens a completed
              submission when editing is still allowed.
            </li>
            <li>
              {data.judgesPerSubmission > 1
                ? `Each submission needs ${data.judgesPerSubmission} judges. After that many completions it locks and shows who judged it.`
                : "Judged & Next completes the current submission and loads the next unscored one."}
            </li>
          </ul>
          <Shot
            src="status-buttons.png"
            alt="The status row showing Pending with a Skip button"
            caption="The status row on a submission. Skip lives here; Resume and Edit Scores appear in the same spot."
          />
          <Shot
            src="progress-card.png"
            alt="The Your Progress card with the completion count, progress bar, and Mark Submission Complete button"
            caption="Your Progress tracks your queue. Mark Submission Complete (or Judged & Next) unlocks once every criterion is scored."
          />

          {/* What each submission shows */}
          <SectionHeading id="submission" eyebrow="On every submission">
            What you will see
          </SectionHeading>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-copy">
            <li>Live app link, GitHub repository, and demo video when the team provided them</li>
            <li>Screenshot and any extra images</li>
            <li>Description, tags, team name and members, and answers to any event questions</li>
            <li>
              Social proof card with launch post engagement when the team shared LinkedIn, X, or
              Bluesky links
            </li>
            <li>Notes: a thread per submission for you and the other judges, with @mentions</li>
          </ul>
          <Shot
            src="notes-thread.png"
            alt="The notes thread on a submission"
            caption="Notes are shared with the other judges and the organizer."
          />

          {/* AI review, only when the AI judge is on */}
          {ai.length > 0 && (
            <>
              <SectionHeading id="ai-review" eyebrow="Advisory">
                AI review
              </SectionHeading>
              <div className="mt-3 space-y-3 text-sm text-copy">
                {ai.map((p, i) => (
                  <p key={i}>
                    {p.startsWith("AI rubric:") ? (
                      <>
                        <span className="font-medium text-ink">AI rubric: </span>
                        <span className="flex flex-wrap gap-1.5 pt-1.5">
                          {data.aiRubricLabels.map((label) => (
                            <span
                              key={label}
                              className="rounded-md border border-hairline bg-surface-alt px-2 py-0.5 text-xs text-copy"
                            >
                              {label}
                            </span>
                          ))}
                        </span>
                      </>
                    ) : (
                      p
                    )}
                  </p>
                ))}
                {showAiResultsLink(data) && (
                  <a
                    href={`${origin}/judging/${data.slug}/ai-results`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-ink underline underline-offset-2"
                  >
                    Open the AI results page
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                )}
                {data.aiReviewVisibleToJudges && (
                  <Shot
                    src="ai-review-card.png"
                    alt="The collapsed AI review card on a submission"
                    caption="The AI review card is collapsed by default. Score first, then compare."
                  />
                )}
              </div>
            </>
          )}

          {/* Navigation */}
          <SectionHeading id="navigation" eyebrow="Tips">
            Finding your way around
          </SectionHeading>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-copy">
            <li>Search by title, filter by tag, by judged status, or by judge.</li>
            <li>The progress bar counts completed submissions against your queue.</li>
            <li>Use the Completed Submissions list to jump back to anything you finished.</li>
            <li>
              Type a number in the # box and press Go to jump straight to that position in the
              list.
            </li>
          </ul>

          {/* Troubleshooting */}
          <SectionHeading id="troubleshooting" eyebrow="When something is off">
            Troubleshooting
          </SectionHeading>
          <div className="mt-3 overflow-hidden rounded-lg border border-hairline">
            <table className="w-full text-sm">
              <thead className="bg-surface-alt text-left text-xs uppercase tracking-wide text-soft">
                <tr>
                  <th className="px-4 py-2 font-medium">Problem</th>
                  <th className="px-4 py-2 font-medium">Fix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline bg-surface">
                {TROUBLESHOOTING.map((t) => (
                  <tr key={t.problem} className="align-top">
                    <td className="px-4 py-2.5 font-medium text-ink">{t.problem}</td>
                    <td className="px-4 py-2.5 text-copy">{t.fix}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Organizer blocks */}
          {hasOrganizerBlocks && (
            <>
              <SectionHeading id="organizer" eyebrow="Event specific">
                From the organizer
              </SectionHeading>
              <div className="mt-3 space-y-4">
                {settings?.privateRepoNote?.trim() && (
                  <div className="rounded-lg border border-hairline bg-surface p-4">
                    <h3 className="text-sm font-medium text-ink">Private repositories</h3>
                    <div className="mt-2">
                      <Prose>{settings.privateRepoNote.trim()}</Prose>
                    </div>
                  </div>
                )}
                {settings?.assignments?.trim() && (
                  <div className="rounded-lg border border-hairline bg-surface p-4">
                    <h3 className="text-sm font-medium text-ink">Judge assignments</h3>
                    <div className="mt-2">
                      <Prose>{settings.assignments.trim()}</Prose>
                    </div>
                  </div>
                )}
                {settings?.notes?.trim() && (
                  <div className="rounded-lg border border-hairline bg-surface p-4">
                    <h3 className="text-sm font-medium text-ink">Notes</h3>
                    <div className="mt-2">
                      <Prose>{settings.notes.trim()}</Prose>
                    </div>
                  </div>
                )}
                {settings?.contact?.trim() && (
                  <div className="rounded-lg border border-hairline bg-surface p-4">
                    <h3 className="text-sm font-medium text-ink">Contact</h3>
                    <div className="mt-2">
                      <Prose>{settings.contact.trim()}</Prose>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Links at the bottom */}
          <SectionHeading id="links" eyebrow="One more time">
            Links
          </SectionHeading>
          <div className="mt-3">
            <LinksCard links={links} title="Links you need" />
          </div>
          {data.hasJudgePassword && (
            <p className="mt-4 text-xs text-soft">
              Access code: <AccessCodeChip value={code} />
              {code === ACCESS_CODE_PLACEHOLDER
                ? " is a placeholder. The real code arrives from your organizer."
                : ". The real code arrives from your organizer."}
            </p>
          )}
        </article>
      </div>
    </div>
  );
}
