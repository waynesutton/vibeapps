import React, { useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Link, useSearchParams } from "react-router-dom";
import { TagManagement } from "./TagManagement";
import { ContentModeration } from "./ContentModeration";
import { Settings } from "./Settings";
import { Forms } from "./Forms";
import { ReportManagement } from "./ReportManagement";
import { NumbersView } from "./NumbersView";
// FormResults is typically viewed via a specific form, not as a main tab.
// Consider removing it from the main tabs if it doesn't show an overview.

// Define the possible tabs
type AdminTab = "content" | "tags" | "forms" | "reports" | "numbers" | "settings";

export function AdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as AdminTab) || "content";
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);

  const handleTabChange = (value: string) => {
    const newTab = value as AdminTab;
    setActiveTab(newTab);
    setSearchParams({ tab: newTab }, { replace: true }); // Update URL query param
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link to="/" className="text-sm text-[#545454] hover:text-[#525252] inline-block mb-6">
        ← Back to Apps Home
      </Link>

      <h1 className="text-2xl font-medium text-[#2A2825] mb-8">Admin Dashboard</h1>

      <Tabs.Root value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <Tabs.List className="flex flex-wrap gap-1 sm:gap-4 border-b border-gray-200">
          {(
            [
              { value: "content", label: "Moderation" },
              { value: "tags", label: "Tags" },
              { value: "forms", label: "Forms" },
              { value: "reports", label: "Reports" },
              { value: "numbers", label: "Numbers" },
              { value: "settings", label: "Settings" },
            ] as { value: AdminTab; label: string }[]
          ).map((tab) => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className="px-3 sm:px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 data-[state=active]:text-[#2A2825] data-[state=active]:border-b-2 data-[state=active]:border-[#2A2825] focus:outline-none focus:z-10 whitespace-nowrap">
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

        <Tabs.Content value="forms" className="focus:outline-none">
          <Forms />
        </Tabs.Content>

        <Tabs.Content value="reports" className="focus:outline-none">
          <ReportManagement />
        </Tabs.Content>

        <Tabs.Content value="numbers" className="focus:outline-none">
          <NumbersView />
        </Tabs.Content>

        <Tabs.Content value="settings" className="focus:outline-none">
          <Settings />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
