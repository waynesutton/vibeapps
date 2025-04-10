import React from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { Link } from 'react-router-dom';
import { TagManagement } from './TagManagement';
import { ContentModeration } from './ContentModeration';
import { Settings } from './Settings';
import { Forms } from './Forms';
import { FormResults } from './FormResults';

export function AdminDashboard() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link to="/" className="text-[#787672] hover:text-[#525252] inline-block mb-6">
        ← Back to Apps
      </Link>
      
      <h1 className="text-2xl font-bold text-[#2A2825] mb-8">Admin Dashboard</h1>
      
      <Tabs.Root defaultValue="content" className="space-y-6">
        <Tabs.List className="flex gap-4 border-b border-[#F4F0ED]">
          <Tabs.Trigger
            value="content"
            className="px-4 py-2 text-[#787672] hover:text-[#525252] data-[state=active]:text-[#2A2825] data-[state=active]:border-b-2 data-[state=active]:border-[#2A2825]"
          >
            Content Moderation
          </Tabs.Trigger>
          <Tabs.Trigger
            value="tags"
            className="px-4 py-2 text-[#787672] hover:text-[#525252] data-[state=active]:text-[#2A2825] data-[state=active]:border-b-2 data-[state=active]:border-[#2A2825]"
          >
            Tag Management
          </Tabs.Trigger>
          <Tabs.Trigger
            value="forms"
            className="px-4 py-2 text-[#787672] hover:text-[#525252] data-[state=active]:text-[#2A2825] data-[state=active]:border-b-2 data-[state=active]:border-[#2A2825]"
          >
            Forms
          </Tabs.Trigger>
          <Tabs.Trigger
            value="results"
            className="px-4 py-2 text-[#787672] hover:text-[#525252] data-[state=active]:text-[#2A2825] data-[state=active]:border-b-2 data-[state=active]:border-[#2A2825]"
          >
            Results
          </Tabs.Trigger>
          <Tabs.Trigger
            value="settings"
            className="px-4 py-2 text-[#787672] hover:text-[#525252] data-[state=active]:text-[#2A2825] data-[state=active]:border-b-2 data-[state=active]:border-[#2A2825]"
          >
            Settings
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="content">
          <ContentModeration />
        </Tabs.Content>

        <Tabs.Content value="tags">
          <TagManagement />
        </Tabs.Content>

        <Tabs.Content value="forms">
          <Forms />
        </Tabs.Content>

        <Tabs.Content value="results">
          <FormResults />
        </Tabs.Content>

        <Tabs.Content value="settings">
          <Settings />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}