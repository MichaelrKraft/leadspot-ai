'use client';

import { useState, useEffect } from 'react';
import { VoiceAgentList } from '@/components/voice-ai/VoiceAgentList';
import { CallLogTable } from '@/components/voice-ai/CallLogTable';
import { VoiceAnalytics } from '@/components/voice-ai/VoiceAnalytics';
import { WalletWidget } from '@/components/billing';

interface VoiceAgent {
  id: string;
  name: string;
  type: string;
  status: string;
  phoneNumber?: string;
  _count: { calls: number };
}

interface VoiceCall {
  id: string;
  direction: string;
  status: string;
  phoneNumber: string;
  duration?: number;
  outcome?: string;
  startedAt: string;
  agent: { id: string; name: string; type: string };
  transcript?: { id: string } | null;
}

interface WalletData {
  balance: number;
  lowBalanceAt: number;
}


export default function VoiceAIDashboard() {
  const [agents, setAgents] = useState<VoiceAgent[]>([]);
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletLoading, setWalletLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    loadWallet();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [agentsRes, callsRes] = await Promise.all([
        fetch('/api/voice/agents'),
        fetch('/api/voice/calls?limit=10'),
      ]);

      if (!agentsRes.ok || !callsRes.ok) {
        throw new Error('Failed to load data');
      }

      const agentsData = await agentsRes.json();
      const callsData = await callsRes.json();

      setAgents(Array.isArray(agentsData) ? agentsData : []);
      setCalls(callsData.calls || []);
    } catch (err) {
      console.error('Error loading voice data:', err);
      setError('Failed to load voice AI data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadWallet = async () => {
    setWalletLoading(true);
    try {
      const res = await fetch('/api/billing/wallet');
      if (res.ok) {
        const data = await res.json();
        setWallet(data);
      }
    } catch (err) {
      console.error('Error loading wallet:', err);
    } finally {
      setWalletLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-mautic-blue mx-auto mb-4"></div>
          <p className="text-gray-500">Loading Voice AI...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Voice AI</h1>
          <p className="text-gray-500 text-sm">
            Powered by LiveKit Agents • Real phone calls with AI
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Wallet Widget */}
          <WalletWidget
            balance={wallet?.balance ?? 0}
            lowBalanceAt={wallet?.lowBalanceAt}
            loading={walletLoading}
          />
          <a
            href="/voice-ai/agents/new"
            className="bg-mautic-blue text-white px-4 py-2 rounded-lg hover:bg-mautic-blue-dark transition font-medium"
          >
            + Create Agent
          </a>
        </div>
      </div>

      {/* Analytics */}
      <VoiceAnalytics agents={agents} calls={calls} />

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <VoiceAgentList agents={agents} onRefresh={loadData} />
        <CallLogTable calls={calls} />
      </div>

      {/* Quick Start Guide (show when no agents) */}
      {agents.length === 0 && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            🚀 Quick Start Guide
          </h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl mb-2">1️⃣</div>
              <h4 className="font-medium text-gray-900">Create an Agent</h4>
              <p className="text-gray-500 mt-1">
                Set up a voice agent for lead qualification, appointment booking, or support.
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl mb-2">2️⃣</div>
              <h4 className="font-medium text-gray-900">Connect Phone</h4>
              <p className="text-gray-500 mt-1">
                Link a Twilio phone number to receive inbound calls.
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl mb-2">3️⃣</div>
              <h4 className="font-medium text-gray-900">Go Live</h4>
              <p className="text-gray-500 mt-1">
                Activate your agent and start handling calls automatically.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
