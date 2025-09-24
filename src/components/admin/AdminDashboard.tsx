import { useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Link, useSearchParams } from "react-router-dom";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { NotFoundPage } from "../../pages/NotFoundPage";
import { TagManagement } from "./TagManagement";
import { ContentModeration } from "./ContentModeration";
import { Settings } from "./Settings";
import { Forms } from "./Forms";
import { ReportManagement } from "./ReportManagement";
import { NumbersView } from "./NumbersView";
import { UserModeration } from "./UserModeration";
import { FormFieldManagement } from "./FormFieldManagement";
import { Judging } from "./Judging";
import { SubmitFormManagement } from "./SubmitFormManagement";
// FormResults is typically viewed via a specific form, not as a main tab.
// Consider removing it from the main tabs if it doesn't show an overview.

// Define the possible main tabs
type MainAdminTab =
  | "content"
  | "tags"
  | "submit-forms"
  | "judging"
  | "numbers"
  | "users"
  | "settings";

// Define sub-tabs
type SubmitSubTab = "submit-forms-list" | "form-fields" | "forms";
type UserSubTab = "user-moderation" | "reports";

export function AdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMainTab = (searchParams.get("tab") as MainAdminTab) || "content";
  const [activeMainTab, setActiveMainTab] =
    useState<MainAdminTab>(initialMainTab);

  const initialSubmitSubTab =
    (searchParams.get("subtab") as SubmitSubTab) || "submit-forms-list";
  const [activeSubmitSubTab, setActiveSubmitSubTab] =
    useState<SubmitSubTab>(initialSubmitSubTab);

  const initialUserSubTab =
    (searchParams.get("subtab") as UserSubTab) || "user-moderation";
  const [activeUserSubTab, setActiveUserSubTab] =
    useState<UserSubTab>(initialUserSubTab);

  const { isLoading: authIsLoading, isAuthenticated } = useConvexAuth();

  // Check if user is admin
  const isUserAdmin = useQuery(
    api.users.checkIsUserAdmin,
    isAuthenticated ? {} : "skip",
  );

  const handleMainTabChange = (value: string) => {
    const newTab = value as MainAdminTab;
    setActiveMainTab(newTab);
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

  if (authIsLoading || (isAuthenticated && isUserAdmin === undefined)) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 text-center">
        Loading authentication...
      </div>
    );
  }

  // Show 404 for non-authenticated users or users without admin role
  if (!isAuthenticated || isUserAdmin === false) {
    return <NotFoundPage />;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link
        to="/"
        className="text-sm text-[#545454] hover:text-[#525252] inline-block mb-6"
      >
        ← Back to Apps Home
      </Link>

      <h1 className="text-2xl font-medium text-[#292929] mb-8">
        Admin Dashboard
      </h1>

      <Tabs.Root
        value={activeMainTab}
        onValueChange={handleMainTabChange}
        className="space-y-6"
      >
        <Tabs.List className="flex flex-wrap gap-1 sm:gap-4 border-b border-gray-200">
          {(
            [
              { value: "content", label: "Moderation" },
              { value: "tags", label: "Tags" },
              { value: "submit-forms", label: "Forms" },
              { value: "judging", label: "Judging" },
              { value: "numbers", label: "Numbers" },
              { value: "users", label: "User Moderation" },
              { value: "settings", label: "Settings" },
            ] as { value: MainAdminTab; label: string }[]
          ).map((tab) => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className="px-3 sm:px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 data-[state=active]:text-[#292929] data-[state=active]:border-b-2 data-[state=active]:border-[#292929] focus:outline-none focus:z-10 whitespace-nowrap"
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="content" className="focus:outline-none">
          <ContentModeration />
        </Tabs.Content>

        <Tabs.Content value="tags" className="focus:outline-none">
          <TagManagement />
        </Tabs.Content>

        <Tabs.Content value="submit-forms" className="focus:outline-none">
          <Tabs.Root
            value={activeSubmitSubTab}
            onValueChange={(value) => handleSubTabChange("submit-forms", value)}
            className="space-y-6"
          >
            <Tabs.List className="flex flex-wrap gap-1 sm:gap-4 border-b border-gray-200">
              <Tabs.Trigger
                value="submit-forms-list"
                className="px-3 sm:px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 data-[state=active]:text-[#292929] data-[state=active]:border-b-2 data-[state=active]:border-[#292929] focus:outline-none focus:z-10 whitespace-nowrap"
              >
                Submit Forms
              </Tabs.Trigger>
              <Tabs.Trigger
                value="form-fields"
                className="px-3 sm:px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 data-[state=active]:text-[#292929] data-[state=active]:border-b-2 data-[state=active]:border-[#292929] focus:outline-none focus:z-10 whitespace-nowrap"
              >
                Story Form Fields
              </Tabs.Trigger>
              <Tabs.Trigger
                value="forms"
                className="px-3 sm:px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 data-[state=active]:text-[#292929] data-[state=active]:border-b-2 data-[state=active]:border-[#292929] focus:outline-none focus:z-10 whitespace-nowrap"
              >
                Custom Forms
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content
              value="submit-forms-list"
              className="focus:outline-none"
            >
              <SubmitFormManagement />
            </Tabs.Content>
            <Tabs.Content value="form-fields" className="focus:outline-none">
              <FormFieldManagement />
            </Tabs.Content>
            <Tabs.Content value="forms" className="focus:outline-none">
              <Forms />
            </Tabs.Content>
          </Tabs.Root>
        </Tabs.Content>

        <Tabs.Content value="judging" className="focus:outline-none">
          <Judging />
        </Tabs.Content>

        <Tabs.Content value="numbers" className="focus:outline-none">
          <NumbersView />
        </Tabs.Content>

        <Tabs.Content value="users" className="focus:outline-none">
          <Tabs.Root
            value={activeUserSubTab}
            onValueChange={(value) => handleSubTabChange("users", value)}
            className="space-y-6"
          >
            <Tabs.List className="flex flex-wrap gap-1 sm:gap-4 border-b border-gray-200">
              <Tabs.Trigger
                value="user-moderation"
                className="px-3 sm:px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 data-[state=active]:text-[#292929] data-[state=active]:border-b-2 data-[state=active]:border-[#292929] focus:outline-none focus:z-10 whitespace-nowrap"
              >
                Users
              </Tabs.Trigger>
              <Tabs.Trigger
                value="reports"
                className="px-3 sm:px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 data-[state=active]:text-[#292929] data-[state=active]:border-b-2 data-[state=active]:border-[#292929] focus:outline-none focus:z-10 whitespace-nowrap"
              >
                Reports
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content
              value="user-moderation"
              className="focus:outline-none"
            >
              <UserModeration />
            </Tabs.Content>
            <Tabs.Content value="reports" className="focus:outline-none">
              <ReportManagement />
            </Tabs.Content>
          </Tabs.Root>
        </Tabs.Content>

        <Tabs.Content value="settings" className="focus:outline-none">
          <Settings />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
