'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AgentConfigTabs } from '@/components/voice-ai/AgentConfigTabs';
import { AgentConfig, DEFAULT_AGENT_CONFIG } from '@/components/voice-ai/types';

const AGENT_TYPES = [
  {
    id: 'lead_qualification',
    name: 'Lead Qualification',
    description: 'Qualify leads by asking about budget, timeline, and needs',
    defaultPrompt: `You are a friendly lead qualification assistant. Your job is to:
1. Greet the caller warmly
2. Collect their name, phone number, and email
3. Ask about their budget, timeline, and specific needs
4. Determine if they're a qualified lead
5. Offer to schedule a follow-up call if qualified

Be professional, concise, and helpful. Always confirm important details.`,
  },
  {
    id: 'appointment_booking',
    name: 'Appointment Booking',
    description: 'Schedule appointments and send confirmations',
    defaultPrompt: `You are a helpful appointment booking assistant. Your job is to:
1. Greet the caller and ask how you can help
2. Collect their name and contact information
3. Understand what type of appointment they need
4. Find a suitable time that works for them
5. Book the appointment and offer to send a text confirmation

Be friendly, efficient, and accommodating with scheduling.`,
  },
  {
    id: 'customer_support',
    name: 'Customer Support',
    description: 'Handle support questions and troubleshooting',
    defaultPrompt: `You are a helpful customer support assistant. Your job is to:
1. Greet the caller and ask how you can help
2. Listen to their issue or question
3. Provide helpful information or troubleshooting steps
4. If you can't resolve the issue, offer to escalate to a human
5. Ensure the customer feels heard and supported

Be patient, empathetic, and solution-focused.`,
  },
];

export default function NewAgentPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [config, setConfig] = useState<AgentConfig>({
    ...DEFAULT_AGENT_CONFIG,
    type: AGENT_TYPES[0].id,
    systemPrompt: AGENT_TYPES[0].defaultPrompt,
    welcomeMessage: 'Hi there! Thank you for calling. How can I help you today?',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/voice/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create agent');
      }

      router.push('/voice-ai');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/voice-ai"
            className="text-sm text-mautic-blue hover:text-mautic-blue-dark flex items-center gap-1 mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Voice AI
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Create Voice Agent</h1>
          <p className="text-gray-500 mt-1">
            Set up an AI agent to handle phone calls automatically
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Agent Name - Always visible at top */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Agent Name *
                </label>
                <input
                  type="text"
                  required
                  value={config.name}
                  onChange={(e) => setConfig({ ...config, name: e.target.value })}
                  placeholder="e.g., Sales Qualifier, Appointment Bot"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mautic-blue focus:border-mautic-blue transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="tel"
                  value={config.phoneNumber}
                  onChange={(e) => setConfig({ ...config, phoneNumber: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mautic-blue focus:border-mautic-blue transition"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Twilio number for inbound calls. You can add this later.
                </p>
              </div>
            </div>
          </div>

          {/* Tabbed Configuration */}
          <AgentConfigTabs
            config={config}
            onChange={setConfig}
            agentTypes={AGENT_TYPES}
          />

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 flex items-start gap-3">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4 justify-end">
            <Link
              href="/voice-ai"
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || !config.name}
              className="px-6 py-3 bg-mautic-blue text-white rounded-lg hover:bg-mautic-blue-dark transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Agent'
              )}
            </button>
          </div>
        </form>

        {/* Help Text */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-900">Powered by LiveKit Agents</p>
              <p className="text-sm text-blue-700 mt-0.5">
                Your voice agent uses the same technology that powers ChatGPT's Advanced Voice Mode.
                Configure HTTP tools to connect your agent to any API, or add MCP servers for advanced integrations.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
