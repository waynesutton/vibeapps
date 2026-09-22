import { useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import {
  AtSign,
  ExternalLink,
  Heart,
  Linkedin,
  MessageCircle,
  Repeat2,
  Twitter,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

// Social proof snapshot for the judge interface. Reads the same stored
// snapshot the AI judge prompt used, so every judge sees identical numbers
// captured at the same moment. Renders nothing when no snapshot exists yet;
// the plain links above it stay as they are.
export function SocialProofCard({
  groupId,
  storyId,
  sessionId,
}: {
  groupId: Id<"judgingGroups">;
  storyId: Id<"stories">;
  sessionId: string;
}) {
  const snapshots = useQuery(api.socialProof.getSocialProofForStory, {
    groupId,
    storyId,
    sessionId,
  });

  if (!snapshots || snapshots.length === 0) return null;

  return (
    <div>
      <h4 className="font-medium text-ink mb-2">Social proof</h4>
      <div className="space-y-2">
        {snapshots.map((snap) => (
          <SnapshotRow key={snap.field} snap={snap} />
        ))}
      </div>
    </div>
  );
}

type Snapshot = NonNullable<
  ReturnType<typeof useQuery<typeof api.socialProof.getSocialProofForStory>>
>[number];

function platformLabel(platform: Snapshot["platform"]): string {
  if (platform === "x") return "X";
  if (platform === "bluesky") return "Bluesky";
  if (platform === "linkedin") return "LinkedIn";
  return "Link";
}

function PlatformIcon({ platform }: { platform: Snapshot["platform"] }) {
  const cls = "w-4 h-4 text-copy flex-shrink-0";
  if (platform === "linkedin") return <Linkedin className={cls} />;
  if (platform === "bluesky") return <AtSign className={cls} />;
  if (platform === "x") return <Twitter className={cls} />;
  return <ExternalLink className={cls} />;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

// One line of status copy per snapshot state, honest about what could and
// could not be read so a judge knows what to verify by hand
function statusNote(snap: Snapshot): string | null {
  switch (snap.status) {
    case "profile_only":
      return `${platformLabel(snap.platform)} profile page, not a post. Open it to look for a launch post.`;
    case "liveness_only":
      return "LinkedIn does not let bots read posts or confirm they exist. Open the post to verify it and its likes and comments.";
    case "failed":
      return snap.live
        ? `Post could not be read${snap.errorMessage ? `: ${snap.errorMessage}` : ""}.`
        : "Post not found at capture time (deleted, private, or wrong URL).";
    case "unsupported":
      return "Unrecognized link; nothing could be verified automatically.";
    default:
      return null;
  }
}

function SnapshotRow({ snap }: { snap: Snapshot }) {
  const hasMetrics =
    snap.likes !== undefined ||
    snap.reposts !== undefined ||
    snap.replies !== undefined;
  const note = statusNote(snap);
  const captured = formatDistanceToNow(snap.fetchedAt, { addSuffix: true });

  return (
    <div className="rounded-md border border-hairline bg-surface p-3 space-y-2">
      {/* Header: platform, kind badge, open link */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <PlatformIcon platform={snap.platform} />
          <span className="text-sm font-medium text-ink">
            {platformLabel(snap.platform)}
          </span>
          <span
            className={`px-1.5 py-0.5 text-[11px] rounded-full border ${
              snap.kind === "post"
                ? "bg-surface-alt border-hairline text-copy"
                : "bg-amber-50 border-amber-200 text-amber-700"
            }`}
          >
            {snap.kind === "post"
              ? "Post"
              : snap.kind === "profile"
                ? "Profile"
                : "Unknown"}
          </span>
          {!snap.live && (
            <span className="px-1.5 py-0.5 text-[11px] rounded-full border bg-red-50 border-red-200 text-red-700">
              Not found
            </span>
          )}
        </div>
        <a
          href={snap.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-copy hover:text-ink hover:underline flex-shrink-0"
          title={snap.url}
        >
          Open <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Author and date when the source exposed them */}
      {(snap.author || snap.postedAt) && (
        <p className="text-xs text-soft truncate">
          {snap.author}
          {snap.author && snap.postedAt ? " · " : ""}
          {snap.postedAt
            ? new Date(snap.postedAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : null}
        </p>
      )}

      {/* Post text excerpt, clamped so long threads do not take the page */}
      {snap.text && (
        <p className="text-sm text-copy whitespace-pre-wrap line-clamp-4">
          {snap.text}
        </p>
      )}

      {/* Metric pills only when the source returned counts */}
      {hasMetrics && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-copy">
          {snap.likes !== undefined && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-alt border border-hairline tabular-nums">
              <Heart className="w-3 h-3" /> {formatCount(snap.likes)}
            </span>
          )}
          {snap.reposts !== undefined && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-alt border border-hairline tabular-nums">
              <Repeat2 className="w-3 h-3" /> {formatCount(snap.reposts)}
            </span>
          )}
          {snap.replies !== undefined && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-alt border border-hairline tabular-nums">
              <MessageCircle className="w-3 h-3" /> {formatCount(snap.replies)}
            </span>
          )}
        </div>
      )}
      {snap.status === "completed" && !hasMetrics && (
        <p className="text-xs text-faint">
          Engagement counts were not readable from this source; open the post
          to verify.
        </p>
      )}

      {note && <p className="text-xs text-soft">{note}</p>}

      <p className="text-[11px] text-faint">Captured {captured}</p>
    </div>
  );
}
