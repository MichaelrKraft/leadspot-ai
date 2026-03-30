'use client';

import { Mic, User, Info } from 'lucide-react';
import type { VoiceAgentConfig, VoiceOption } from '@/lib/voice-agent-templates';
import { VOICES } from '@/lib/voice-agent-templates';

interface PersonalityTabProps {
  config: VoiceAgentConfig;
  onChange: (updates: Partial<VoiceAgentConfig>) => void;
}

function VoiceCard({
  voice,
  selected,
  onSelect,
}: {
  voice: VoiceOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
        selected
          ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-full ${
          selected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {voice.gender === 'female' ? (
          <User className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </div>
      <span
        className={`text-sm font-medium ${
          selected ? 'text-indigo-700' : 'text-slate-700'
        }`}
      >
        {voice.name}
      </span>
      <span className="text-xs text-slate-400">
        {voice.gender === 'female' ? 'Female' : 'Male'} &middot; {voice.style}
      </span>
    </button>
  );
}

export default function PersonalityTab({ config, onChange }: PersonalityTabProps) {
  const inputClass =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

  return (
    <div className="space-y-6">
      {/* Agent Name */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Agent Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={config.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g., Buyer Qualifier"
          className={inputClass}
        />
      </div>

      {/* Voice Selector */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Voice
        </label>
        <div className="grid grid-cols-4 gap-3">
          {VOICES.map((voice) => (
            <VoiceCard
              key={voice.id}
              voice={voice}
              selected={config.voice === voice.id}
              onSelect={() => onChange({ voice: voice.id })}
            />
          ))}
        </div>
      </div>

      {/* Personality */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Personality
        </label>
        <textarea
          value={config.personality}
          onChange={(e) => onChange({ personality: e.target.value })}
          rows={4}
          placeholder="Describe how this agent should behave, what tone to use, and any special instructions..."
          className={inputClass}
        />
        <p className="mt-1 text-xs text-slate-400">
          This guides the AI&apos;s conversational style and decision-making.
        </p>
      </div>

      {/* Opening Script */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Opening Script
        </label>
        <textarea
          value={config.openingScript}
          onChange={(e) => onChange({ openingScript: e.target.value })}
          rows={3}
          placeholder="Hi {{contact_name}}, this is {{agent_name}} from {{company_name}}..."
          className={inputClass}
        />
        <div className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-400">
          <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />
          <span>
            Use {'{{variable}}'} syntax for dynamic values: {'{{contact_name}}'},{' '}
            {'{{agent_name}}'}, {'{{company_name}}'}, {'{{property_address}}'}
          </span>
        </div>
      </div>

      {/* Tone & Interruption */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Tone
          </label>
          <select
            value={config.tone}
            onChange={(e) =>
              onChange({
                tone: e.target.value as VoiceAgentConfig['tone'],
              })
            }
            className={inputClass}
          >
            <option value="professional">Professional</option>
            <option value="friendly">Friendly</option>
            <option value="casual">Casual</option>
            <option value="authoritative">Authoritative</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Allow Interruption
          </label>
          <button
            type="button"
            onClick={() =>
              onChange({ allowInterruption: !config.allowInterruption })
            }
            className={`relative mt-1 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
              config.allowInterruption ? 'bg-indigo-500' : 'bg-slate-200'
            }`}
            role="switch"
            aria-checked={config.allowInterruption}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                config.allowInterruption ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <p className="mt-1 text-xs text-slate-400">
            {config.allowInterruption
              ? 'Agent can be interrupted mid-sentence'
              : 'Agent will finish speaking before listening'}
          </p>
        </div>
      </div>
    </div>
  );
}
