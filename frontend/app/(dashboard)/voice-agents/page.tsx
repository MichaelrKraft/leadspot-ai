'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface VoiceAgent {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'draft';
  callsThisWeek: number;
  qualifiedLeads: number | null;
  appointmentsBooked: number | null;
  avgCallDuration: string;
  description: string;
  voice: string;
  greeting: string;
}

const DEMO_AGENTS: VoiceAgent[] = [
  {
    id: '1',
    name: 'Sales Qualifier',
    status: 'active',
    callsThisWeek: 47,
    qualifiedLeads: 23,
    appointmentsBooked: null,
    avgCallDuration: '3:20',
    description: 'Qualifies inbound leads based on BANT criteria and routes to sales reps.',
    voice: 'Rachel (Female, Professional)',
    greeting: "Hi, this is Sarah from LeadSpot. I'm reaching out because you recently showed interest in our platform. Do you have a moment to chat?",
  },
  {
    id: '2',
    name: 'Appointment Setter',
    status: 'active',
    callsThisWeek: 31,
    qualifiedLeads: null,
    appointmentsBooked: 18,
    avgCallDuration: '2:45',
    description: 'Books appointments with qualified prospects on your Google Calendar.',
    voice: 'James (Male, Friendly)',
    greeting: "Hello! This is James calling from LeadSpot. I'd love to schedule a quick demo with you. What time works best?",
  },
];

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400',
    paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400',
    draft: 'bg-slate-100 text-slate-600 dark:bg-zinc-700/50 dark:text-zinc-400',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${colors[status] || colors.draft}`}>
      {status}
    </span>
  );
}

function ConfigurePanel({ agent, onClose }: { agent: VoiceAgent; onClose: () => void }) {
  const [name, setName] = useState(agent.name);
  const [status, setStatus] = useState(agent.status);
  const [greeting, setGreeting] = useState(agent.greeting);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700/50 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Configure Agent</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-zinc-300">Agent Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-zinc-300">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as VoiceAgent['status'])}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="draft">Draft</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-zinc-300">Voice</label>
            <select
              defaultValue={agent.voice}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option>Rachel (Female, Professional)</option>
              <option>James (Male, Friendly)</option>
              <option>Emily (Female, Warm)</option>
              <option>David (Male, Authoritative)</option>
              <option>Sofia (Female, Energetic)</option>
              <option>Marcus (Male, Calm)</option>
              <option>Aria (Female, Natural)</option>
              <option>Ethan (Male, Conversational)</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-zinc-300">Greeting Script</label>
            <textarea
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        </div>

        <div className="mt-6 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 py-2 text-sm font-medium text-white shadow-sm hover:shadow-md"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function NewAgentPanel({ onClose, onCreate }: { onClose: () => void; onCreate: (agent: VoiceAgent) => void }) {
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('Lead Qualification');
  const [voice, setVoice] = useState('Rachel (Female, Professional)');
  const [greeting, setGreeting] = useState('');

  const purposeDescriptions: Record<string, string> = {
    'Lead Qualification': 'Qualifies inbound leads based on criteria and routes to sales reps.',
    'Appointment Setting': 'Books appointments with qualified prospects on your calendar.',
    'Follow-up Calls': 'Follows up with contacts who haven\'t responded to outreach.',
    'Survey / Feedback': 'Collects feedback and satisfaction scores from customers.',
    'Custom': 'Custom agent with your own script and workflow.',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-zinc-700/50 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Create New Agent</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            onCreate({
              id: `new-${Date.now()}`,
              name: name.trim(),
              status: 'draft',
              callsThisWeek: 0,
              qualifiedLeads: purpose === 'Lead Qualification' || purpose === 'Survey / Feedback' ? 0 : null,
              appointmentsBooked: purpose === 'Appointment Setting' ? 0 : null,
              avgCallDuration: '0:00',
              description: purposeDescriptions[purpose] || 'Custom voice agent.',
              voice,
              greeting: greeting.trim() || `Hi, this is your AI assistant from LeadSpot. How can I help you today?`,
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-zinc-300">Agent Name *</label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Follow-up Caller"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-zinc-300">Purpose</label>
            <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
              <option>Lead Qualification</option>
              <option>Appointment Setting</option>
              <option>Follow-up Calls</option>
              <option>Survey / Feedback</option>
              <option>Custom</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-zinc-300">Voice</label>
            <select value={voice} onChange={(e) => setVoice(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
              <option>Rachel (Female, Professional)</option>
              <option>James (Male, Friendly)</option>
              <option>Emily (Female, Warm)</option>
              <option>David (Male, Authoritative)</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-zinc-300">Greeting Script</label>
            <textarea
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              placeholder="Hi, this is [name] from [company]..."
              rows={3}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
          </div>

          <div className="mt-6 flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 py-2 text-sm font-medium text-white shadow-sm hover:shadow-md"
            >
              Create Agent
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function VoiceAgentsPage() {
  const [agents, setAgents] = useState<VoiceAgent[]>(DEMO_AGENTS);

  useEffect(() => {
    const saved = localStorage.getItem('leadspot-voice-agents');
    if (saved) {
      try {
        const custom = JSON.parse(saved) as VoiceAgent[];
        setAgents([...custom, ...DEMO_AGENTS]);
      } catch {
        // Ignore invalid JSON
      }
    }
  }, []);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Voice Agents</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            Your AI-powered outbound calling agents.
          </p>
        </div>
        <Link
          href="/voice-agents/new"
          className="rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md"
        >
          + New Agent
        </Link>
      </div>

      {/* Agent Cards */}
      <div className="grid gap-6 sm:grid-cols-2">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-zinc-800/50 dark:bg-zinc-900"
          >
            <div className="mb-2 flex items-start justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">{agent.name}</h3>
              <StatusBadge status={agent.status} />
            </div>
            <p className="mb-5 text-sm text-slate-400 dark:text-zinc-500">{agent.description}</p>

            <div className="mb-5 grid grid-cols-3 gap-4">
              <div className="rounded-xl bg-white p-3 dark:bg-zinc-800/50">
                <p className="text-xs text-slate-400 dark:text-zinc-500">Calls This Week</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-zinc-100">{agent.callsThisWeek}</p>
              </div>
              <div className="rounded-xl bg-white p-3 dark:bg-zinc-800/50">
                <p className="text-xs text-slate-400 dark:text-zinc-500">
                  {agent.qualifiedLeads !== null ? 'Qualified Leads' : 'Appointments'}
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-zinc-100">
                  {agent.qualifiedLeads !== null ? agent.qualifiedLeads : agent.appointmentsBooked}
                </p>
              </div>
              <div className="rounded-xl bg-white p-3 dark:bg-zinc-800/50">
                <p className="text-xs text-slate-400 dark:text-zinc-500">Avg Call</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-zinc-100">{agent.avgCallDuration}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Link
                href={`/voice-agents/edit/${agent.id}`}
                className="flex flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Configure
              </Link>
              <button
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  agent.status === 'active'
                    ? 'border border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-400 dark:hover:bg-yellow-500/20'
                    : 'border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-500/10 dark:text-green-400 dark:hover:bg-green-500/20'
                }`}
              >
                {agent.status === 'active' ? 'Pause' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
