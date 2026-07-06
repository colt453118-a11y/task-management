'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SettingsTab = 'general' | 'security' | 'team' | 'notifications';

const tabs: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'security', label: 'Security' },
  { id: 'team', label: 'Team' },
  { id: 'notifications', label: 'Notifications' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-surface-900 dark:text-surface-50">Settings</h1>
        <p className="mt-1 text-sm text-surface-500">Manage your workspace settings and preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-surface-200 dark:border-surface-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'border-b-2 border-brand-500 text-brand-600'
                : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="max-w-2xl space-y-6">
        {activeTab === 'general' && (
          <>
            <Section title="Organization Name" description="This is the name of your workspace">
              <input
                type="text"
                defaultValue="Default Organization"
                className="w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-100"
              />
            </Section>

            <Section title="Slug" description="Your workspace URL identifier">
              <input
                type="text"
                defaultValue="default"
                className="w-full rounded-md border border-surface-300 bg-surface-50 px-3 py-2 text-sm text-surface-500 dark:border-surface-600 dark:bg-surface-800"
                disabled
              />
            </Section>

            <Section title="Description" description="Brief description of your workspace">
              <textarea
                rows={3}
                className="w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-100"
                placeholder="Describe your workspace..."
              />
            </Section>

            <div className="pt-2">
              <Button>Save Changes</Button>
            </div>
          </>
        )}

        {activeTab === 'security' && (
          <>
            <Section title="Password" description="Change your account password">
              <div className="space-y-3">
                <input
                  type="password"
                  placeholder="Current password"
                  className="w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-100"
                />
                <input
                  type="password"
                  placeholder="New password"
                  className="w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-100"
                />
                <Button variant="outline">Update Password</Button>
              </div>
            </Section>

            <Section title="Two-Factor Authentication" description="Add an extra layer of security">
              <Button variant="outline" disabled>Coming soon</Button>
            </Section>

            <Section title="Active Sessions" description="Manage your active sessions">
              <div className="rounded-md border border-surface-200 bg-surface-50 p-3 text-sm text-surface-500 dark:border-surface-700 dark:bg-surface-800">
                No other active sessions
              </div>
            </Section>
          </>
        )}

        {activeTab === 'team' && (
          <>
            <Section title="Default Role" description="Role assigned to new members">
              <select className="w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-100">
                <option>Member</option>
                <option>Administrator</option>
              </select>
            </Section>

            <Section title="Member Invitation" description="Allow members to invite new users">
              <label className="flex items-center gap-3">
                <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500" />
                <span className="text-sm text-surface-700 dark:text-surface-300">Allow team members to invite new users</span>
              </label>
            </Section>

            <Section title="Departments" description="Manage organization departments">
              <div className="rounded-md border border-surface-200 bg-surface-50 p-3 text-sm dark:border-surface-700 dark:bg-surface-800">
                <div className="flex items-center justify-between">
                  <span className="text-surface-700 dark:text-surface-300">Engineering</span>
                  <span className="text-surface-500">19 members</span>
                </div>
              </div>
            </Section>
          </>
        )}

        {activeTab === 'notifications' && (
          <>
            <Section title="Email Notifications" description="Choose what emails you receive">
              <div className="space-y-3">
                {['Task assigned to you', 'Mentions in comments', 'Task due reminders', 'Status changes', 'Weekly summary'].map(
                  (item) => (
                    <label key={item} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-sm text-surface-700 dark:text-surface-300">{item}</span>
                    </label>
                  ),
                )}
              </div>
            </Section>

            <Section title="In-App Notifications" description="Configure in-app notification preferences">
              <div className="space-y-3">
                {['Show due date warnings', 'Notify on @mentions', 'Weekly digest'].map((item) => (
                  <label key={item} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm text-surface-700 dark:text-surface-300">{item}</span>
                  </label>
                ))}
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-surface-200 pb-6 last:border-0 dark:border-surface-700">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-50">{title}</h3>
        <p className="text-xs text-surface-500">{description}</p>
      </div>
      {children}
    </div>
  );
}
