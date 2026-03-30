'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  ClipboardList,
  Zap,
  BookOpen,
  ChevronDown,
} from 'lucide-react';
import type { VoiceAgentConfig } from '@/lib/voice-agent-templates';
import {
  DEFAULT_CONFIG,
  TEMPLATES,
  VOICES,
} from '@/lib/voice-agent-templates';
import PersonalityTab from '@/components/voice-agents/PersonalityTab';
import QualificationTab from '@/components/voice-agents/QualificationTab';
import ActionsTab from '@/components/voice-agents/ActionsTab';
import KnowledgeTab from '@/components/voice-agents/KnowledgeTab';

type TabKey = 'personality' | 'qualification' | 'actions' | 'knowledge';

const TABS: { key: TabKey; label: string; icon: typeof User }[] = [
  { key: 'personality', label: 'Personality', icon: User },
  { key: 'qualification', label: 'Qualification', icon: ClipboardList },
  { key: 'actions', label: 'Actions', icon: Zap },
  { key: 'knowledge', label: 'Knowledge', icon: BookOpen },
];

const TEMPLATE_OPTIONS = [
  { value: 'blank', label: 'Blank Agent' },
  { value: 'buyer-qualifier', label: 'Buyer Qualifier' },
  { value: 'listing-caller', label: 'Listing Caller' },
  { value: 'follow-up-agent', label: 'Follow-up Agent' },
];

export default function NewVoiceAgentPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('personality');
  const [config, setConfig] = useState<VoiceAgentConfig>({
    ...DEFAULT_CONFIG,
  });
  const [selectedTemplate, setSelectedTemplate] = useState('blank');

  const handleTemplateChange = (templateKey: string) => {
    setSelectedTemplate(templateKey);
    if (templateKey === 'blank') {
      setConfig({ ...DEFAULT_CONFIG });
    } else {
      const template = TEMPLATES[templateKey];
      if (template) {
        setConfig({ ...template });
      }
    }
  };

  const handleChange = (updates: Partial<VoiceAgentConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  const handleCreate = () => {
    if (!config.name.trim()) {
      setActiveTab('personality');
      return;
    }

    // Find the voice display name
    const voiceObj = VOICES.find((v) => v.id === config.voice);
    const voiceDisplay = voiceObj
      ? `${voiceObj.name} (${voiceObj.gender === 'female' ? 'Female' : 'Male'}, ${voiceObj.style})`
      : config.voice;

    // Build a VoiceAgent compatible with the listing page
    const newAgent = {
      id: `custom-${Date.now()}`,
      name: config.name,
      status: 'draft' as const,
      callsThisWeek: 0,
      qualifiedLeads: config.qualificationSteps.length > 0 ? 0 : null,
      appointmentsBooked: config.duringCallActions.bookAppointment ? 0 : null,
      avgCallDuration: '0:00',
      description: config.personality.slice(0, 100) + (config.personality.length > 100 ? '...' : ''),
      voice: voiceDisplay,
      greeting: config.openingScript,
    };

    // Save to localStorage
    const existing = localStorage.getItem('leadspot-voice-agents');
    let agents = [];
    if (existing) {
      try {
        agents = JSON.parse(existing);
      } catch {
        agents = [];
      }
    }
    agents.unshift(newAgent);
    localStorage.setItem('leadspot-voice-agents', JSON.stringify(agents));

    // Also save full config for potential future editing
    const existingConfigs = localStorage.getItem('leadspot-voice-agent-configs');
    let configs: Record<string, VoiceAgentConfig> = {};
    if (existingConfigs) {
      try {
        configs = JSON.parse(existingConfigs);
      } catch {
        configs = {};
      }
    }
    configs[newAgent.id] = config;
    localStorage.setItem(
      'leadspot-voice-agent-configs',
      JSON.stringify(configs)
    );

    router.push('/voice-agents');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/voice-agents"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Create Voice Agent
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Configure your AI-powered calling agent step by step.
            </p>
          </div>
        </div>

        {/* Template Selector */}
        <div className="relative">
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Start from template
          </label>
          <div className="relative">
            <select
              value={selectedTemplate}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm font-medium text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {TEMPLATE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-white p-1 shadow-sm border border-slate-200">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {activeTab === 'personality' && (
          <PersonalityTab config={config} onChange={handleChange} />
        )}
        {activeTab === 'qualification' && (
          <QualificationTab
            steps={config.qualificationSteps}
            onChange={(steps) => handleChange({ qualificationSteps: steps })}
          />
        )}
        {activeTab === 'actions' && (
          <ActionsTab config={config} onChange={handleChange} />
        )}
        {activeTab === 'knowledge' && (
          <KnowledgeTab config={config} onChange={handleChange} />
        )}
      </div>

      {/* Footer Actions */}
      <div className="mt-6 flex items-center justify-between">
        <Link
          href="/voice-agents"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          Cancel
        </Link>
        <button
          type="button"
          onClick={handleCreate}
          className="rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md"
        >
          Create Agent
        </button>
      </div>
    </div>
  );
}
