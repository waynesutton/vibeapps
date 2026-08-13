import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "convex/react";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bot,
  ClipboardList,
  FileText,
  Gavel,
  LayoutDashboard,
  Link2,
  Lock,
  Mail,
  PanelLeft,
  PanelLeftClose,
  ScrollText,
  Settings,
  Sparkles,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import { NotFoundPage } from "./NotFoundPage";
import {
  AdminAccessProvider,
  useAdminAccess,
  useAdminAccessQuery,
} from "../components/admin/useAdminAccess";
import type { GroupDetails } from "../components/admin/judging/groupSection";
import { JudgingCriteriaEditor } from "../components/admin/JudgingCriteriaEditor";
import { JudgingResultsDashboard } from "../components/admin/JudgingResultsDashboard";
import { AIJudgeResults } from "../components/admin/AIJudgeResults";
import { JudgeTracking } from "../components/admin/JudgeTracking";
import { GroupOverviewSection } from "../components/admin/judging/GroupOverviewSection";
import { GroupSettingsSection } from "../components/admin/judging/GroupSettingsSection";
import { GroupAccessSection } from "../components/admin/judging/GroupAccessSection";
import { GroupSubmissionsSection } from "../components/admin/judging/GroupSubmissionsSection";
import { GroupSubmitPageSection } from "../components/admin/judging/GroupSubmitPageSection";
import { GroupAiSection } from "../components/admin/judging/GroupAiSection";
import { GroupEmailsSection } from "../components/admin/judging/GroupEmailsSection";
import { GroupLinksSection } from "../components/admin/judging/GroupLinksSection";
import { GroupActivitySection } from "../components/admin/judging/GroupActivitySection";
import { GroupSlugEditor } from "../components/admin/judging/GroupSlugEditor";

// Sidebar sections. Each maps to a ?section= value and a permission key
// (null means visible to anyone who can open the page).
const SECTIONS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, perm: null },
  { key: "links", label: "Links", icon: Link2, perm: null },
  {
    key: "settings",
    label: "Settings",
    icon: Settings,
    perm: "judging.manage",
  },
  { key: "access", label: "Access", icon: Lock, perm: "judging.manage" },
  { key: "criteria", label: "Criteria", icon: Gavel, perm: "judging.manage" },
  {
    key: "submissions",
    label: "Submissions",
    icon: ClipboardList,
    perm: "judging.manage",
  },
  {
    key: "submit-page",
    label: "Submit page",
    icon: FileText,
    perm: "judging.manage",
  },
  { key: "ai", label: "AI judge", icon: Sparkles, perm: "judging.ai.any" },
  { key: "emails", label: "Emails", icon: Mail, perm: "judging.emails" },
  {
    key: "results",
    label: "Results",
    icon: BarChart3,
    perm: "judging.results",
  },
  { key: "ai-results", label: "AI results", icon: Bot, perm: "judging.ai" },
  {
    key: "tracking",
    label: "Judge tracking",
    icon: Activity,
    perm: "judging.tracking",
  },
  // Per-group audit log; anyone who can open the page (judging.view) can read it
  { key: "activity", label: "Activity", icon: ScrollText, perm: null },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

// Full-page docs-style workspace for one judging group at
// /admin/judging/:slug?section=... with a sticky section sidebar.
export default function AdminJudgingGroupPage() {
  const { slug } = useParams<{ slug: string }>();
  const { isLoading, isAuthenticated, access } = useAdminAccessQuery();

  const canView =
    access !== null &&
    (access.isAdmin || access.permissions.includes("judging.view"));

  const groupBySlug = useQuery(
    api.judgingGroups.getGroupBySlug,
    slug && !isLoading && isAuthenticated && canView ? { slug } : "skip",
  );

  const group = useQuery(
    api.judgingGroups.getGroupWithDetails,
    groupBySlug ? { groupId: groupBySlug._id } : "skip",
  );

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 text-center text-sm text-soft">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated || !canView || !access) {
    return <NotFoundPage />;
  }

  if (groupBySlug === null) {
    return <NotFoundPage />;
  }

  if (groupBySlug === undefined || group === undefined) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 text-center text-sm text-soft">
        Loading judging group...
      </div>
    );
  }

  if (group === null) {
    return <NotFoundPage />;
  }

  return (
    <AdminAccessProvider access={access}>
      <GroupWorkspace group={group} />
    </AdminAccessProvider>
  );
}

// Sidebar collapse preference persists across visits
const SIDEBAR_COLLAPSED_KEY = "judgingGroupSidebarCollapsed";

function GroupWorkspace({ group }: { group: GroupDetails }) {
  const { can: canPerm } = useAdminAccess();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true",
  );

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(!prev));
      return !prev;
    });
  };

  // "judging.ai.any" shows the AI section for either manage or ai grants
  const can = (perm: string): boolean =>
    perm === "judging.ai.any"
      ? canPerm("judging.manage") || canPerm("judging.ai")
      : canPerm(perm);

  const visibleSections = SECTIONS.filter(
    (s) => s.perm === null || can(s.perm),
  );

  const requested = searchParams.get("section") as SectionKey | null;
  const activeSection: SectionKey =
    requested && visibleSections.some((s) => s.key === requested)
      ? requested
      : "overview";

  const setSection = (key: SectionKey) => {
    setSearchParams(key === "overview" ? {} : { section: key }, {
      replace: false,
    });
  };

  const canManage = can("judging.manage");
  const canDelete = can("judging.delete");
  const canChangeSlug = can("judging.slug");
  const canAi = can("judging.ai");

  return (
    <div className="max-w-7xl mx-auto px-4 py-5">
      {/* Header: sidebar toggle, back link, group identity, status */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <Link
            to="/admin?tab=judging"
            className="inline-flex items-center gap-1.5 text-[13px] text-soft hover:text-ink transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Judging groups
          </Link>
          <button
            type="button"
            onClick={toggleSidebar}
            className="hidden md:inline-flex p-1.5 text-faint hover:text-copy hover:bg-surface-hover rounded-md transition-colors"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={
              sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
            aria-expanded={!sidebarCollapsed}
          >
            {sidebarCollapsed ? (
              <PanelLeft className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <h1 className="text-xl font-semibold text-ink">{group.name}</h1>
          <span
            className={`px-2 py-0.5 text-xs rounded-full ${
              group.isActive
                ? "bg-green-100 text-green-700"
                : "bg-surface-alt text-copy"
            }`}
          >
            {group.isActive ? "Active" : "Inactive"}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-faint font-mono">
            /judging/{group.slug}
            {canChangeSlug && (
              <GroupSlugEditor
                groupId={group._id}
                currentSlug={group.slug}
              />
            )}
          </span>
        </div>
        {group.description && (
          <p className="text-[13px] text-soft mt-1 max-w-2xl">
            {group.description}
          </p>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-5">
        {/* Docs-style sidebar: sticky on desktop, horizontal scroll on mobile.
            Collapsed mode shows icons only so the content column widens. */}
        <nav
          aria-label="Judging group sections"
          className={`flex-shrink-0 ${sidebarCollapsed ? "md:w-10" : "md:w-44"}`}
        >
          <div className="md:sticky md:top-5 flex md:flex-col gap-0.5 overflow-x-auto md:overflow-visible pb-2 md:pb-0 -mx-1 px-1">
            {visibleSections.map((section) => {
              const isActive = section.key === activeSection;
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setSection(section.key)}
                  aria-current={isActive ? "page" : undefined}
                  title={sidebarCollapsed ? section.label : undefined}
                  aria-label={section.label}
                  className={`flex items-center gap-2 px-2.5 py-1.5 text-[13px] rounded-md transition-colors whitespace-nowrap text-left ${
                    isActive
                      ? "bg-surface-alt text-ink font-medium"
                      : "text-soft hover:text-ink hover:bg-surface-hover"
                  }`}
                >
                  <section.icon className="w-4 h-4 flex-shrink-0" />
                  <span className={sidebarCollapsed ? "md:hidden" : ""}>
                    {section.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Active section content */}
        <div className="flex-1 min-w-0">
          {activeSection === "overview" && (
            <GroupOverviewSection group={group} canManage={canManage} />
          )}
          {activeSection === "links" && <GroupLinksSection group={group} />}
          {activeSection === "settings" && canManage && (
            <GroupSettingsSection
              group={group}
              canDelete={canDelete}
              canChangeSlug={canChangeSlug}
            />
          )}
          {activeSection === "access" && canManage && (
            <GroupAccessSection group={group} />
          )}
          {activeSection === "criteria" && canManage && (
            <JudgingCriteriaEditor
              groupId={group._id}
              groupName={group.name}
              scoreScale={group.scoreScale}
            />
          )}
          {activeSection === "submissions" && canManage && (
            <GroupSubmissionsSection group={group} />
          )}
          {activeSection === "submit-page" && canManage && (
            <GroupSubmitPageSection group={group} />
          )}
          {activeSection === "ai" && (
            <GroupAiSection group={group} canManage={canManage} canAi={canAi} />
          )}
          {activeSection === "emails" && can("judging.emails") && (
            <GroupEmailsSection group={group} />
          )}
          {activeSection === "results" && can("judging.results") && (
            <JudgingResultsDashboard groupId={group._id} />
          )}
          {activeSection === "ai-results" && canAi && (
            <AIJudgeResults groupId={group._id} groupName={group.name} />
          )}
          {activeSection === "tracking" && can("judging.tracking") && (
            <JudgeTracking groupId={group._id} groupName={group.name} />
          )}
          {activeSection === "activity" && (
            <GroupActivitySection group={group} canManage={canManage} />
          )}
        </div>
      </div>
    </div>
  );
}
