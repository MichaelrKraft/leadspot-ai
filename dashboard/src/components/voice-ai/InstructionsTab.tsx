'use client';

import { useRef } from 'react';
import { AgentConfig, CustomVariable } from './types';
import { VariableInsertButton } from './VariableInsertButton';

interface Props {
  config: AgentConfig;
  onChange: (updates: Partial<AgentConfig>) => void;
  agentTypes: Array<{
    id: string;
    name: string;
    description: string;
    defaultPrompt: string;
  }>;
}

export function InstructionsTab({ config, onChange, agentTypes }: Props) {
  const welcomeRef = useRef<HTMLTextAreaElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const handleTypeChange = (typeId: string) => {
    const type = agentTypes.find((t) => t.id === typeId);
    onChange({
      type: typeId,
      systemPrompt: type?.defaultPrompt || '',
    });
  };

  const insertVariableAt = (ref: React.RefObject<HTMLTextAreaElement | null>, variable: string) => {
    const textarea = ref.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = textarea.value;
    const newValue = currentValue.substring(0, start) + variable + currentValue.substring(end);

    // Update the appropriate field
    if (ref === welcomeRef) {
      onChange({ welcomeMessage: newValue });
    } else if (ref === promptRef) {
      onChange({ systemPrompt: newValue });
    }

    // Restore cursor position after React updates
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  const addCustomVariable = () => {
    onChange({
      customVariables: [...config.customVariables, { key: '', value: '' }],
    });
  };

  const updateCustomVariable = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...config.customVariables];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ customVariables: updated });
  };

  const removeCustomVariable = (index: number) => {
    onChange({
      customVariables: config.customVariables.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-6">
      {/* Agent Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Agent Type
        </label>
        <div className="grid gap-3">
          {agentTypes.map((type) => (
            <label
              key={type.id}
              className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition ${
                config.type === type.id
                  ? 'border-mautic-blue bg-mautic-blue/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="type"
                value={type.id}
                checked={config.type === type.id}
                onChange={() => handleTypeChange(type.id)}
                className="sr-only"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">{type.name}</div>
                <div className="text-sm text-gray-500 mt-0.5">{type.description}</div>
              </div>
              {config.type === type.id && (
                <svg className="w-5 h-5 text-mautic-blue" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* Welcome Message */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Welcome Message
          </label>
          <VariableInsertButton
            customVariables={config.customVariables}
            onInsert={(variable) => insertVariableAt(welcomeRef, variable)}
          />
        </div>
        <p className="text-sm text-gray-500 mb-3">
          The first message your agent says when a call begins
        </p>
        <textarea
          ref={welcomeRef}
          value={config.welcomeMessage}
          onChange={(e) => onChange({ welcomeMessage: e.target.value })}
          placeholder="Hi {{caller_name}}, thank you for calling {{company_name}}. How can I help you today?"
          rows={3}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mautic-blue focus:border-mautic-blue transition font-mono text-sm"
        />

        {/* Allow Interruption Toggle */}
        <label className="flex items-center gap-3 mt-3 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              checked={config.allowInterruption}
              onChange={(e) => onChange({ allowInterruption: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-mautic-blue/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-mautic-blue"></div>
          </div>
          <span className="text-sm text-gray-700">
            Allow callers to interrupt the greeting
          </span>
        </label>
      </div>

      {/* System Prompt / Instructions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Instructions
          </label>
          <VariableInsertButton
            customVariables={config.customVariables}
            onInsert={(variable) => insertVariableAt(promptRef, variable)}
          />
        </div>
        <p className="text-sm text-gray-500 mb-3">
          Detailed instructions that define how your agent behaves on calls
        </p>
        <textarea
          ref={promptRef}
          value={config.systemPrompt}
          onChange={(e) => onChange({ systemPrompt: e.target.value })}
          rows={10}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mautic-blue focus:border-mautic-blue transition font-mono text-sm"
        />
      </div>

      {/* Custom Variables */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Custom Variables
          </label>
          <button
            type="button"
            onClick={addCustomVariable}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-mautic-blue hover:text-mautic-blue-dark hover:bg-mautic-blue/5 rounded-lg transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Variable
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          Define custom key-value pairs to use in your prompts
        </p>

        {config.customVariables.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
            <div className="text-gray-400 text-2xl mb-2">{ }</div>
            <p className="text-sm text-gray-500">
              No custom variables yet. Click "Add Variable" to create one.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {config.customVariables.map((variable, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={variable.key}
                    onChange={(e) => updateCustomVariable(index, 'key', e.target.value.replace(/\s/g, '_'))}
                    placeholder="variable_name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mautic-blue focus:border-mautic-blue transition text-sm font-mono"
                  />
                </div>
                <span className="text-gray-400">=</span>
                <div className="flex-1">
                  <input
                    type="text"
                    value={variable.value}
                    onChange={(e) => updateCustomVariable(index, 'value', e.target.value)}
                    placeholder="value"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mautic-blue focus:border-mautic-blue transition text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeCustomVariable(index)}
                  className="p-2 text-gray-400 hover:text-red-500 transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
