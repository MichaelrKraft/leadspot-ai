'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  ClipboardList,
  Zap,
  BookOpen,
  Save,
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

/** Default configs for the two demo agents — maps to template data */
const DEMO_AGENT_CONFIGS: Record<string, VoiceAgentConfig> = {
  '1': {
    ...TEMPLATES['buyer-qualifier'],
    name: 'Sales Qualifier',
    openingScript:
      "Hi, this is Sarah from LeadSpot. I'm reaching out because you recently showed interest in our platform. Do you have a moment to chat?",
  },
  '2': {
    ...TEMPLATES['listing-caller'],
    name: 'Appointment Setter',
    openingScript:
      "Hello! This is James calling from LeadSpot. I'd love to schedule a quick demo with you. What time works best?",
  },
};

export default function EditVoiceAgentPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = params.id as string;

  const [activeTab, setActiveTab] = useState<TabKey>('personality');
  const [config, setConfig] = useState<VoiceAgentConfig | null>(null);
  const [agentName, setAgentName] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Try localStorage first (custom agents)
    const savedConfigs = localStorage.getItem('leadspot-voice-agent-configs');
    if (savedConfigs) {
      try {
        const configs = JSON.parse(savedConfigs) as Record<string, VoiceAgentConfig>;
        if (configs[agentId]) {
          setConfig(configs[agentId]);
          setAgentName(configs[agentId].name);
          return;
        }
      } catch { /* ignore */ }
    }

    // Fall back to demo agent configs
    if (DEMO_AGENT_CONFIGS[agentId]) {
      setConfig(DEMO_AGENT_CONFIGS[agentId]);
      setAgentName(DEMO_AGENT_CONFIGS[agentId].name);
      return;
    }

    // Unknown agent — use default
    setConfig({ ...DEFAULT_CONFIG });
    setAgentName('Unknown Agent');
  }, [agentId]);

  if (!config) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
        <p className="text-sm text-slate-500">Loading agent configuration...</p>
      </div>
    );
  }

  const handleChange = (updates: Partial<VoiceAgentConfig>) => {
    setConfig((prev) => (prev ? { ...prev, ...updates } : prev));
    setSaved(false);
  };

  const handleSave = () => {
    if (!config) return;

    // Save config
    const existingConfigs = localStorage.getItem('leadspot-voice-agent-configs');
    let configs: Record<string, VoiceAgentConfig> = {};
    if (existingConfigs) {
      try { configs = JSON.parse(existingConfigs); } catch { configs = {}; }
    }
    configs[agentId] = config;
    localStorage.setItem('leadspot-voice-agent-configs', JSON.stringify(configs));

    // Update agent listing if it's a custom agent
    const existingAgents = localStorage.getItem('leadspot-voice-agents');
    if (existingAgents) {
      try {
        const agents = JSON.parse(existingAgents) as Array<Record<string, unknown>>;
        const updated = agents.map((a) => {
          if (a.id === agentId) {
            const voiceObj = VOICES.find((v) => v.id === config.voice);
            const voiceDisplay = voiceObj
              ? `${voiceObj.name} (${voiceObj.gender === 'female' ? 'Female' : 'Male'}, ${voiceObj.style})`
              : config.voice;
            return {
              ...a,
              name: config.name,
              voice: voiceDisplay,
              greeting: config.openingScript,
              description: config.personality.slice(0, 100) + (config.personality.length > 100 ? '...' : ''),
            };
          }
          return a;
        });
        localStorage.setItem('leadspot-voice-agents', JSON.stringify(updated));
      } catch { /* ignore */ }
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
              Configure: {agentName}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Edit all settings for this voice agent.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold shadow-sm transition-all ${
            saved
              ? 'bg-green-500 text-white'
              : 'bg-gradient-to-r from-indigo-500 to-indigo-400 text-white hover:shadow-md'
          }`}
        >
          <Save className="h-4 w-4" />
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
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

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between">
        <Link
          href="/voice-agents"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          Back to Agents
        </Link>
        <button
          type="button"
          onClick={() => { handleSave(); router.push('/voice-agents'); }}
          className="rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md"
        >
          Save &amp; Return
        </button>
      </div>
    </div>
  );
}
