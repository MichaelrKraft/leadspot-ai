'use client';

import { Plus, Trash2, ArrowRight, Zap, Phone } from 'lucide-react';
import type { VoiceAgentConfig, PostCallRule } from '@/lib/voice-agent-templates';
import { makeRuleId } from '@/lib/voice-agent-templates';

interface ActionsTabProps {
  config: VoiceAgentConfig;
  onChange: (updates: Partial<VoiceAgentConfig>) => void;
}

const CONDITION_TYPES = [
  { value: 'score_range', label: 'Qualification Score' },
  { value: 'answer_value', label: 'Specific Answer' },
  { value: 'appointment_status', label: 'Appointment Status' },
];

const OPERATORS: Record<string, { value: string; label: string }[]> = {
  score_range: [
    { value: '>=', label: 'is at least' },
    { value: '<=', label: 'is at most' },
    { value: '==', label: 'equals' },
  ],
  answer_value: [
    { value: '==', label: 'equals' },
    { value: '!=', label: 'does not equal' },
    { value: 'contains', label: 'contains' },
  ],
  appointment_status: [
    { value: '==', label: 'is' },
    { value: '!=', label: 'is not' },
  ],
};

const ACTION_TYPES = [
  { value: 'add_tag', label: 'Add Tag' },
  { value: 'enroll_action_plan', label: 'Enroll in Action Plan' },
  { value: 'add_to_smart_list', label: 'Add to Smart List' },
  { value: 'send_sms', label: 'Send SMS' },
  { value: 'update_score', label: 'Update Lead Score' },
];

function ToggleSwitch({
  label,
  description,
  enabled,
  disabled,
  onToggle,
}: {
  label: string;
  description: string;
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
          enabled ? 'bg-indigo-500' : 'bg-slate-200'
        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
        role="switch"
        aria-checked={enabled}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function RuleRow({
  rule,
  onUpdate,
  onDelete,
}: {
  rule: PostCallRule;
  onUpdate: (updates: Partial<PostCallRule>) => void;
  onDelete: () => void;
}) {
  const selectClass =
    'rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';
  const inputClass =
    'rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

  const availableOperators = OPERATORS[rule.condition.type] || OPERATORS.score_range;

  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <span className="text-xs font-semibold uppercase text-slate-400">If</span>
      <select
        value={rule.condition.type}
        onChange={(e) =>
          onUpdate({
            condition: {
              ...rule.condition,
              type: e.target.value as PostCallRule['condition']['type'],
            },
          })
        }
        className={selectClass}
      >
        {CONDITION_TYPES.map((ct) => (
          <option key={ct.value} value={ct.value}>
            {ct.label}
          </option>
        ))}
      </select>

      <select
        value={rule.condition.operator}
        onChange={(e) =>
          onUpdate({
            condition: { ...rule.condition, operator: e.target.value },
          })
        }
        className={selectClass}
      >
        {availableOperators.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>

      <input
        type="text"
        value={rule.condition.value}
        onChange={(e) =>
          onUpdate({
            condition: { ...rule.condition, value: e.target.value },
          })
        }
        placeholder="value"
        className={`w-24 ${inputClass}`}
      />

      <ArrowRight className="h-4 w-4 flex-shrink-0 text-slate-300" />

      <span className="text-xs font-semibold uppercase text-slate-400">Then</span>

      <select
        value={rule.action.type}
        onChange={(e) =>
          onUpdate({
            action: {
              ...rule.action,
              type: e.target.value as PostCallRule['action']['type'],
            },
          })
        }
        className={selectClass}
      >
        {ACTION_TYPES.map((at) => (
          <option key={at.value} value={at.value}>
            {at.label}
          </option>
        ))}
      </select>

      <input
        type="text"
        value={rule.action.target}
        onChange={(e) =>
          onUpdate({
            action: { ...rule.action, target: e.target.value },
          })
        }
        placeholder="target"
        className={`w-32 ${inputClass}`}
      />

      <button
        type="button"
        onClick={onDelete}
        className="ml-auto rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function ActionsTab({ config, onChange }: ActionsTabProps) {
  const updateDuringCall = (
    key: keyof VoiceAgentConfig['duringCallActions'],
    value: boolean
  ) => {
    onChange({
      duringCallActions: { ...config.duringCallActions, [key]: value },
    });
  };

  const addRule = () => {
    const newRule: PostCallRule = {
      id: makeRuleId(),
      condition: { type: 'score_range', operator: '>=', value: '' },
      action: { type: 'add_tag', target: '', label: '' },
    };
    onChange({ postCallRules: [...config.postCallRules, newRule] });
  };

  const updateRule = (id: string, updates: Partial<PostCallRule>) => {
    onChange({
      postCallRules: config.postCallRules.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      ),
    });
  };

  const deleteRule = (id: string) => {
    onChange({
      postCallRules: config.postCallRules.filter((r) => r.id !== id),
    });
  };

  return (
    <div className="space-y-8">
      {/* During Call Actions */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Phone className="h-4 w-4 text-indigo-500" />
          <h3 className="text-sm font-medium text-slate-700">
            During Call Actions
          </h3>
        </div>
        <div className="space-y-3">
          <ToggleSwitch
            label="Save Contact to CRM"
            description="Automatically save or update contact details during the call"
            enabled={config.duringCallActions.saveContact}
            disabled
            onToggle={() => {}}
          />
          <ToggleSwitch
            label="Book Appointment if Qualified"
            description="Offer to schedule a showing or meeting when lead qualifies"
            enabled={config.duringCallActions.bookAppointment}
            onToggle={() =>
              updateDuringCall(
                'bookAppointment',
                !config.duringCallActions.bookAppointment
              )
            }
          />
          <ToggleSwitch
            label="Send Property Link via SMS"
            description="Text a property listing link during the conversation"
            enabled={config.duringCallActions.sendPropertyLink}
            onToggle={() =>
              updateDuringCall(
                'sendPropertyLink',
                !config.duringCallActions.sendPropertyLink
              )
            }
          />
          <ToggleSwitch
            label="Transfer to Live Agent"
            description="Hand off the call to a real person if requested"
            enabled={config.duringCallActions.transferToAgent}
            onToggle={() =>
              updateDuringCall(
                'transferToAgent',
                !config.duringCallActions.transferToAgent
              )
            }
          />
        </div>
      </div>

      {/* Post-Call Rules */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-indigo-500" />
            <div>
              <h3 className="text-sm font-medium text-slate-700">
                Post-Call Automation Rules
              </h3>
              <p className="text-xs text-slate-400">
                Automate actions based on call outcomes.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={addRule}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-600"
          >
            <Plus className="h-4 w-4" />
            Add Rule
          </button>
        </div>

        {config.postCallRules.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <Zap className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">
              No automation rules yet. Add rules to automate post-call workflows.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {config.postCallRules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              onUpdate={(updates) => updateRule(rule.id, updates)}
              onDelete={() => deleteRule(rule.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
