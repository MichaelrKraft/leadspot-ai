'use client';

import { useState } from 'react';

interface VoiceAgent {
  id: string;
  name: string;
  type: string;
  status: string;
  phoneNumber?: string;
  _count: { calls: number };
}

interface Props {
  agents: VoiceAgent[];
  onRefresh: () => void;
}

const typeLabels: Record<string, string> = {
  lead_qualification: 'Lead Qualification',
  appointment_booking: 'Appointment Booking',
  customer_support: 'Customer Support',
};

const typeIcons: Record<string, string> = {
  lead_qualification: '🎯',
  appointment_booking: '📅',
  customer_support: '💬',
};

export function VoiceAgentList({ agents, onRefresh }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  const toggleStatus = async (agentId: string, currentStatus: string) => {
    setLoading(agentId);
    try {
      await fetch(`/api/voice/agents/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: currentStatus === 'active' ? 'inactive' : 'active',
        }),
      });
      onRefresh();
    } catch (error) {
      console.error('Failed to toggle agent status:', error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Voice Agents</h2>
        <a
          href="/voice-ai/agents/new"
          className="text-sm bg-mautic-blue text-white px-3 py-1.5 rounded-lg hover:bg-mautic-blue-dark transition"
        >
          + New Agent
        </a>
      </div>
      <div className="divide-y">
        {agents.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-3">🤖</div>
            <p className="text-gray-500 mb-4">No voice agents yet</p>
            <a
              href="/voice-ai/agents/new"
              className="text-mautic-blue hover:text-mautic-blue-dark font-medium"
            >
              Create your first agent →
            </a>
          </div>
        ) : (
          agents.map((agent) => (
            <div 
              key={agent.id} 
              className="p-4 flex items-center justify-between hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-xl">
                  {typeIcons[agent.type] || '🤖'}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{agent.name}</h3>
                  <p className="text-sm text-gray-500">
                    {typeLabels[agent.type] || agent.type} • {agent._count.calls} calls
                  </p>
                  {agent.phoneNumber && (
                    <p className="text-xs text-gray-400">{agent.phoneNumber}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`px-2 py-1 text-xs rounded-full font-medium ${
                    agent.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : agent.status === 'testing'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {agent.status}
                </span>
                <button
                  onClick={() => toggleStatus(agent.id, agent.status)}
                  disabled={loading === agent.id}
                  className="text-sm text-mautic-blue hover:text-mautic-blue-dark disabled:opacity-50"
                >
                  {loading === agent.id 
                    ? '...' 
                    : agent.status === 'active' 
                    ? 'Pause' 
                    : 'Activate'
                  }
                </button>
                <a
                  href={`/voice-ai/agents/${agent.id}`}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  Edit
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
