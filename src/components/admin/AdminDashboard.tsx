import { useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Link, useSearchParams } from "react-router-dom";
import { NotFoundPage } from "../../pages/NotFoundPage";
import { TagManagement } from "./TagManagement";
import { ContentModeration } from "./ContentModeration";
import { Settings } from "./Settings";
// import { Forms } from "./Forms"; // Legacy Custom Forms builder, sub-tab hidden below
import { ReportManagement } from "./ReportManagement";
import { NumbersView } from "./NumbersView";
import { UserModeration } from "./UserModeration";
import { FormFieldManagement } from "./FormFieldManagement";
import { Judging } from "./Judging";
import { EmailManagement } from "./EmailManagement";
import { UserReportManagement } from "./UserReportManagement";
import { AccessManagement } from "./AccessManagement";
import { AdminDocs } from "./AdminDocs";
import { SpamCheck } from "./SpamCheck";
import { ActivityLog } from "./ActivityLog";
import {
  AdminAccessProvider,
  useAdminAccessQuery,
  type AdminAccess,
} from "./useAdminAccess";

// Define the possible main tabs
type MainAdminTab =
  | "content"
  | "ai-spam"
  | "tags"
  | "submit-forms"
  | "judging"
  | "numbers"
  | "users"
  | "emails"
  | "activity"
  | "settings"
  | "access"
  | "docs";

// Define sub-tabs
type SubmitSubTab = "form-fields" | "forms";
type UserSubTab = "user-moderation" | "reports" | "user-reports";

// Whether a tab is visible for the current access
function isTabVisible(tab: MainAdminTab, access: AdminAccess): boolean {
  const has = (key: string) =>
    access.isAdmin || access.permissions.includes(key);
  switch (tab) {
    case "content":
      return has("moderation.view");
    case "ai-spam":
      return has("moderation.view");
    case "tags":
      return has("tags.view");
    case "submit-forms":
      return has("forms.view");
    case "judging":
      return has("judging.view");
    case "numbers":
      return has("numbers.view");
    case "users":
      return has("users.view") || has("users.reports");
    case "emails":
      return has("emails.view") || has("emails.send");
    case "activity":
      return has("activity.view") || has("activity.manage");
    case "settings":
      return has("settings.view") || has("settings.manage");
    case "access":
      return access.isAdmin; // never delegatable
    case "docs":
      return access.isAdmin || has("judging.view");
  }
}

const ALL_TABS: Array<{ value: MainAdminTab; label: string }> = [
  { value: "content", label: "Moderation" },
  { value: "ai-spam", label: "AI Spam" },
  { value: "tags", label: "Tags" },
  { value: "submit-forms", label: "Forms" },
  { value: "judging", label: "Judging" },
  { value: "numbers", label: "Numbers" },
  { value: "users", label: "User Moderation" },
  { value: "emails", label: "Email Management" },
  { value: "activity", label: "Activity" },
  { value: "settings", label: "Settings" },
  { value: "access", label: "Access" },
  { value: "docs", label: "Docs" },
];

export function AdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isLoading, isAuthenticated, access } = useAdminAccessQuery();

  const [requestedMainTab, setRequestedMainTab] = useState<MainAdminTab>(
    (searchParams.get("tab") as MainAdminTab) || "content",
  );

  // Coerce the hidden legacy "forms" sub-tab back to form fields
  const rawSubmitSubTab = searchParams.get("subtab") as SubmitSubTab | null;
  const initialSubmitSubTab =
    rawSubmitSubTab && rawSubmitSubTab !== "forms"
      ? rawSubmitSubTab
      : "form-fields";
  const [activeSubmitSubTab, setActiveSubmitSubTab] =
    useState<SubmitSubTab>(initialSubmitSubTab);

  const initialUserSubTab =
    (searchParams.get("subtab") as UserSubTab) || "user-moderation";
  const [activeUserSubTab, setActiveUserSubTab] =
    useState<UserSubTab>(initialUserSubTab);

  const handleMainTabChange = (value: string) => {
    const newTab = value as MainAdminTab;
    setRequestedMainTab(newTab);
    setSearchParams({ tab: newTab }, { replace: true }); // Update URL query param, removing subtab
  };

  const handleSubTabChange = (
    mainTab: "submit-forms" | "users",
    subTabValue: string,
  ) => {
    if (mainTab === "submit-forms") {
      const newSubTab = subTabValue as SubmitSubTab;
      setActiveSubmitSubTab(newSubTab);
      setSearchParams({ tab: mainTab, subtab: newSubTab }, { replace: true });
    } else if (mainTab === "users") {
      const newSubTab = subTabValue as UserSubTab;
      setActiveUserSubTab(newSubTab);
      setSearchParams({ tab: mainTab, subtab: newSubTab }, { replace: true });
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 text-center">
        Loading authentication...
      </div>
    );
  }

  // Show 404 for non-authenticated users or users without any admin access
  if (!isAuthenticated || access === null) {
    return <NotFoundPage />;
  }

  const visibleTabs = ALL_TABS.filter((tab) => isTabVisible(tab.value, access));
  // Fall back to the first permitted tab when the requested one is not allowed
  const activeMainTab = visibleTabs.some((t) => t.value === requestedMainTab)
    ? requestedMainTab
    : (visibleTabs[0]?.value ?? "content");

  const canViewUsers = access.isAdmin || access.permissions.includes("users.view");
  const canViewReports =
    access.isAdmin || access.permissions.includes("users.reports");
  const activeUserSubTabSafe =
    activeUserSubTab === "user-moderation" && !canViewUsers
      ? "reports"
      : (activeUserSubTab === "reports" || activeUserSubTab === "user-reports") &&
          !canViewReports
        ? "user-moderation"
        : activeUserSubTab;

  return (
    <AdminAccessProvider access={access}>
      <div className="max-w-6xl mx-auto px-4 py-5">
        <Link
          to="/"
          className="text-[13px] text-soft hover:text-ink inline-block mb-2"
        >
          ← Back to Apps Home
        </Link>

        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-medium text-ink">
            Admin Dashboard
          </h1>
          {!access.isAdmin && (
            <span className="text-xs font-medium text-soft bg-surface-alt border border-hairline rounded-full px-3 py-1">
              Delegated access
            </span>
          )}
        </div>

        <Tabs.Root
          value={activeMainTab}
          onValueChange={handleMainTabChange}
          className="space-y-4"
        >
          <Tabs.List className="flex flex-wrap gap-0.5 sm:gap-2 border-b border-hairline">
            {visibleTabs.map((tab) => (
              <Tabs.Trigger
                key={tab.value}
                value={tab.value}
                className="px-2.5 sm:px-3 py-1.5 text-[13px] font-medium text-soft hover:text-copy data-[state=active]:text-ink data-[state=active]:border-b-2 data-[state=active]:border-ink focus:outline-none focus:z-10 whitespace-nowrap"
              >
                {tab.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          {isTabVisible("content", access) && (
            <Tabs.Content value="content" className="focus:outline-none">
              <ContentModeration />
            </Tabs.Content>
          )}

          {isTabVisible("ai-spam", access) && (
            <Tabs.Content value="ai-spam" className="focus:outline-none">
              <SpamCheck />
            </Tabs.Content>
          )}

          {isTabVisible("tags", access) && (
            <Tabs.Content value="tags" className="focus:outline-none">
              <TagManagement />
            </Tabs.Content>
          )}

          {isTabVisible("submit-forms", access) && (
            <Tabs.Content value="submit-forms" className="focus:outline-none">
              <Tabs.Root
                value={activeSubmitSubTab}
                onValueChange={(value) =>
                  handleSubTabChange("submit-forms", value)
                }
                className="space-y-4"
              >
                <Tabs.List className="flex flex-wrap gap-1 sm:gap-4 border-b border-hairline">
                  <Tabs.Trigger
                    value="form-fields"
                    className="px-2.5 sm:px-3 py-1.5 text-[13px] font-medium text-soft hover:text-copy data-[state=active]:text-ink data-[state=active]:border-b-2 data-[state=active]:border-ink focus:outline-none focus:z-10 whitespace-nowrap"
                  >
                    Story Form Fields
                  </Tabs.Trigger>
                  {/* Custom Forms sub-tab hidden: legacy custom form builder.
                      Re-enable by uncommenting the trigger and content below.
                  <Tabs.Trigger
                    value="forms"
                    className="px-2.5 sm:px-3 py-1.5 text-[13px] font-medium text-soft hover:text-copy data-[state=active]:text-ink data-[state=active]:border-b-2 data-[state=active]:border-ink focus:outline-none focus:z-10 whitespace-nowrap"
                  >
                    Custom Forms
                  </Tabs.Trigger>
                  */}
                </Tabs.List>
                <Tabs.Content value="form-fields" className="focus:outline-none">
                  <FormFieldManagement />
                </Tabs.Content>
                {/* Custom Forms content hidden alongside the trigger above.
                <Tabs.Content value="forms" className="focus:outline-none">
                  <Forms />
                </Tabs.Content>
                */}
              </Tabs.Root>
            </Tabs.Content>
          )}

          {isTabVisible("judging", access) && (
            <Tabs.Content value="judging" className="focus:outline-none">
              <Judging />
            </Tabs.Content>
          )}

          {isTabVisible("numbers", access) && (
            <Tabs.Content value="numbers" className="focus:outline-none">
              <NumbersView />
            </Tabs.Content>
          )}

          {isTabVisible("users", access) && (
            <Tabs.Content value="users" className="focus:outline-none">
              <Tabs.Root
                value={activeUserSubTabSafe}
                onValueChange={(value) => handleSubTabChange("users", value)}
                className="space-y-4"
              >
                <Tabs.List className="flex flex-wrap gap-1 sm:gap-4 border-b border-hairline">
                  {canViewUsers && (
                    <Tabs.Trigger
                      value="user-moderation"
                      className="px-2.5 sm:px-3 py-1.5 text-[13px] font-medium text-soft hover:text-copy data-[state=active]:text-ink data-[state=active]:border-b-2 data-[state=active]:border-ink focus:outline-none focus:z-10 whitespace-nowrap"
                    >
                      Users
                    </Tabs.Trigger>
                  )}
                  {canViewReports && (
                    <Tabs.Trigger
                      value="reports"
                      className="px-2.5 sm:px-3 py-1.5 text-[13px] font-medium text-soft hover:text-copy data-[state=active]:text-ink data-[state=active]:border-b-2 data-[state=active]:border-ink focus:outline-none focus:z-10 whitespace-nowrap"
                    >
                      Content Reports
                    </Tabs.Trigger>
                  )}
                  {canViewReports && (
                    <Tabs.Trigger
                      value="user-reports"
                      className="px-2.5 sm:px-3 py-1.5 text-[13px] font-medium text-soft hover:text-copy data-[state=active]:text-ink data-[state=active]:border-b-2 data-[state=active]:border-ink focus:outline-none focus:z-10 whitespace-nowrap"
                    >
                      User Reports
                    </Tabs.Trigger>
                  )}
                </Tabs.List>
                {canViewUsers && (
                  <Tabs.Content
                    value="user-moderation"
                    className="focus:outline-none"
                  >
                    <UserModeration />
                  </Tabs.Content>
                )}
                {canViewReports && (
                  <Tabs.Content value="reports" className="focus:outline-none">
                    <ReportManagement />
                  </Tabs.Content>
                )}
                {canViewReports && (
                  <Tabs.Content
                    value="user-reports"
                    className="focus:outline-none"
                  >
                    <UserReportManagement />
                  </Tabs.Content>
                )}
              </Tabs.Root>
            </Tabs.Content>
          )}

          {isTabVisible("emails", access) && (
            <Tabs.Content value="emails" className="focus:outline-none">
              <EmailManagement />
            </Tabs.Content>
          )}

          {isTabVisible("activity", access) && (
            <Tabs.Content value="activity" className="focus:outline-none">
              <ActivityLog />
            </Tabs.Content>
          )}

          {isTabVisible("settings", access) && (
            <Tabs.Content value="settings" className="focus:outline-none">
              <Settings />
            </Tabs.Content>
          )}

          {isTabVisible("access", access) && (
            <Tabs.Content value="access" className="focus:outline-none">
              <AccessManagement />
            </Tabs.Content>
          )}

          {isTabVisible("docs", access) && (
            <Tabs.Content value="docs" className="focus:outline-none">
              <AdminDocs />
            </Tabs.Content>
          )}
        </Tabs.Root>
      </div>
    </AdminAccessProvider>
  );
}
