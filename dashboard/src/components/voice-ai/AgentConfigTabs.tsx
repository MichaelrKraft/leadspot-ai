'use client';

import { useState } from 'react';
import { AgentConfig } from './types';
import { InstructionsTab } from './InstructionsTab';
import { ModelsVoiceTab } from './ModelsVoiceTab';
import { ActionsTab } from './ActionsTab';

interface Props {
  config: AgentConfig;
  onChange: (config: AgentConfig) => void;
  agentTypes: Array<{
    id: string;
    name: string;
    description: string;
    defaultPrompt: string;
  }>;
}

type TabId = 'instructions' | 'models' | 'actions';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  {
    id: 'instructions',
    label: 'Instructions',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: 'models',
    label: 'Models & Voice',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
  },
  {
    id: 'actions',
    label: 'Actions',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
];

export function AgentConfigTabs({ config, onChange, agentTypes }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('instructions');

  const updateConfig = (updates: Partial<AgentConfig>) => {
    onChange({ ...config, ...updates });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-mautic-blue text-mautic-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'instructions' && (
          <InstructionsTab
            config={config}
            onChange={updateConfig}
            agentTypes={agentTypes}
          />
        )}

        {activeTab === 'models' && (
          <ModelsVoiceTab
            config={config}
            onChange={updateConfig}
          />
        )}

        {activeTab === 'actions' && (
          <ActionsTab
            config={config}
            onChange={updateConfig}
          />
        )}
      </div>
    </div>
  );
}
