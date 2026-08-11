import { useMutation } from "convex/react";
import {
  Award,
  ClipboardList,
  Gavel,
  Users,
} from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import {
  GroupDetails,
  SectionCard,
  TogglePill,
  UrlRow,
} from "./groupSection";

// Landing panel for a group: live stats, status toggles, and the public
// URLs with copy buttons. Toggles only render for judging.manage.
export function GroupOverviewSection({
  group,
  canManage,
}: {
  group: GroupDetails;
  canManage: boolean;
}) {
  const updateGroup = useMutation(api.judgingGroups.updateGroup);

  const stats = [
    {
      label: "Submissions",
      value: group.submissionCount,
      icon: ClipboardList,
    },
    { label: "Judges", value: group.judgeCount, icon: Users },
    { label: "Criteria", value: group.criteria.length, icon: Gavel },
    {
      label: "Judges per submission",
      value: group.judgesPerSubmission ?? 1,
      icon: Award,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Slim stat strip instead of big stat cards */}
      <div className="rounded-lg border border-hairline bg-surface divide-y divide-hairline sm:divide-y-0 sm:divide-x sm:grid sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="px-4 py-3 flex items-center gap-3">
            <stat.icon className="w-4 h-4 text-faint flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-lg font-semibold text-ink leading-tight tabular-nums">
                {stat.value}
              </p>
              <p className="text-xs text-soft truncate">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <SectionCard
        title="Status"
        description="Current state of this judging group."
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-ink">
              Judging {group.isActive ? "active" : "paused"}
            </p>
            <p className="text-xs text-soft">
              {group.isActive
                ? "Judges can score submissions right now"
                : "Judges cannot access this group until activated"}
            </p>
          </div>
          {canManage ? (
            <TogglePill
              enabled={group.isActive}
              onToggle={() =>
                void updateGroup({
                  groupId: group._id,
                  isActive: !group.isActive,
                })
              }
              onLabel="Active"
              offLabel="Inactive"
            />
          ) : (
            <span
              className={`px-2.5 py-1 text-xs rounded-full ${
                group.isActive
                  ? "bg-green-100 text-green-700"
                  : "bg-surface-alt text-copy"
              }`}
            >
              {group.isActive ? "Active" : "Inactive"}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-ink">
              Judge access
            </p>
            <p className="text-xs text-soft">
              {group.isPublic
                ? "Anyone with the link can judge"
                : "Judges need a password"}
            </p>
          </div>
          {canManage ? (
            <TogglePill
              enabled={group.isPublic}
              onToggle={() =>
                void updateGroup({
                  groupId: group._id,
                  isPublic: !group.isPublic,
                })
              }
              onLabel="Public"
              offLabel="Private"
            />
          ) : (
            <span className="px-2.5 py-1 text-xs rounded-full bg-surface-alt text-copy">
              {group.isPublic ? "Public" : "Private"}
            </span>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Public pages"
        description="Share these links with judges and participants."
      >
        <div className="space-y-2">
          <UrlRow
            label="Judging interface"
            path={`/judging/${group.slug}`}
            hint={group.isPublic ? undefined : "Password protected"}
          />
          <UrlRow
            label="Results page"
            path={`/judging/${group.slug}/results`}
            hint={
              group.resultsIsPublic ? undefined : "Password protected"
            }
          />
          {group.hasCustomSubmissionPage && (
            <UrlRow
              label="Custom submission page"
              path={`/judging/${group.slug}/submit`}
              hint={
                group.submissionPagePassword
                  ? "Password protected"
                  : undefined
              }
            />
          )}
          {group.aiJudgeEnabled && (
            <UrlRow
              label="AI results page"
              path={`/judging/${group.slug}/ai-results`}
              hint={
                group.aiResultsIsPublic ? undefined : "Password protected"
              }
            />
          )}
        </div>
      </SectionCard>
    </div>
  );
}
