'use client';

import { Plus, Trash2, Home, Building2, ShieldCheck, HelpCircle, Variable } from 'lucide-react';
import type { VoiceAgentConfig } from '@/lib/voice-agent-templates';

interface KnowledgeTabProps {
  config: VoiceAgentConfig;
  onChange: (updates: Partial<VoiceAgentConfig>) => void;
}

export default function KnowledgeTab({ config, onChange }: KnowledgeTabProps) {
  const inputClass =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

  // Property context helpers
  const updateProperty = (
    key: keyof VoiceAgentConfig['propertyContext'],
    value: string
  ) => {
    onChange({
      propertyContext: { ...config.propertyContext, [key]: value },
    });
  };

  // Company info helpers
  const updateCompany = (
    key: keyof VoiceAgentConfig['companyInfo'],
    value: string
  ) => {
    onChange({
      companyInfo: { ...config.companyInfo, [key]: value },
    });
  };

  // FAQ helpers
  const addFaq = () => {
    onChange({
      faqResponses: [
        ...config.faqResponses,
        { question: '', answer: '' },
      ],
    });
  };

  const updateFaq = (
    index: number,
    field: 'question' | 'answer',
    value: string
  ) => {
    const updated = [...config.faqResponses];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ faqResponses: updated });
  };

  const deleteFaq = (index: number) => {
    onChange({
      faqResponses: config.faqResponses.filter((_, i) => i !== index),
    });
  };

  // Custom variables helpers
  const addVariable = () => {
    onChange({
      customVariables: [
        ...config.customVariables,
        { key: '', value: '' },
      ],
    });
  };

  const updateVariable = (
    index: number,
    field: 'key' | 'value',
    value: string
  ) => {
    const updated = [...config.customVariables];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ customVariables: updated });
  };

  const deleteVariable = (index: number) => {
    onChange({
      customVariables: config.customVariables.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-8">
      {/* Property Context */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Home className="h-4 w-4 text-indigo-500" />
          <div>
            <h3 className="text-sm font-medium text-slate-700">
              Property Context
            </h3>
            <p className="text-xs text-slate-400">
              Details about the property this agent is calling about (optional).
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Property Address
            </label>
            <input
              type="text"
              value={config.propertyContext.address}
              onChange={(e) => updateProperty('address', e.target.value)}
              placeholder="123 Main St, Anytown, ST 12345"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Price
              </label>
              <input
                type="text"
                value={config.propertyContext.price}
                onChange={(e) => updateProperty('price', e.target.value)}
                placeholder="$450,000"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Beds
              </label>
              <input
                type="text"
                value={config.propertyContext.beds}
                onChange={(e) => updateProperty('beds', e.target.value)}
                placeholder="3"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Baths
              </label>
              <input
                type="text"
                value={config.propertyContext.baths}
                onChange={(e) => updateProperty('baths', e.target.value)}
                placeholder="2"
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Property Description
            </label>
            <textarea
              value={config.propertyContext.description}
              onChange={(e) => updateProperty('description', e.target.value)}
              rows={3}
              placeholder="Beautiful 3-bed, 2-bath home in a quiet neighborhood with a large backyard..."
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Company Info */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-indigo-500" />
          <div>
            <h3 className="text-sm font-medium text-slate-700">
              Company Information
            </h3>
            <p className="text-xs text-slate-400">
              Used for introductions and compliance disclosures.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Brokerage / Company Name
              </label>
              <input
                type="text"
                value={config.companyInfo.name}
                onChange={(e) => updateCompany('name', e.target.value)}
                placeholder="Acme Realty"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Agent Name
              </label>
              <input
                type="text"
                value={config.companyInfo.agentName}
                onChange={(e) => updateCompany('agentName', e.target.value)}
                placeholder="John Smith"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Phone Number
              </label>
              <input
                type="text"
                value={config.companyInfo.phone}
                onChange={(e) => updateCompany('phone', e.target.value)}
                placeholder="(555) 123-4567"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Website
              </label>
              <input
                type="text"
                value={config.companyInfo.website}
                onChange={(e) => updateCompany('website', e.target.value)}
                placeholder="https://acmerealty.com"
                className={inputClass}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Compliance Notes */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-indigo-500" />
          <div>
            <h3 className="text-sm font-medium text-slate-700">
              Compliance Notes
            </h3>
            <p className="text-xs text-slate-400">
              Regulatory guidelines the agent must follow.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <textarea
            value={config.complianceNotes}
            onChange={(e) => onChange({ complianceNotes: e.target.value })}
            rows={4}
            placeholder="Always disclose that this is an AI-powered call. Follow Fair Housing Act guidelines: do not discriminate based on race, color, religion, sex, disability, familial status, or national origin. Do not make guarantees about property values or investment returns."
            className={inputClass}
          />
        </div>
      </div>

      {/* FAQ Responses */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-indigo-500" />
            <div>
              <h3 className="text-sm font-medium text-slate-700">
                FAQ Responses
              </h3>
              <p className="text-xs text-slate-400">
                Pre-written answers to common questions.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={addFaq}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-600"
          >
            <Plus className="h-4 w-4" />
            Add FAQ
          </button>
        </div>

        {config.faqResponses.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <HelpCircle className="mx-auto mb-2 h-6 w-6 text-slate-300" />
            <p className="text-sm text-slate-500">
              No FAQ responses yet. Add common questions and answers.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {config.faqResponses.map((faq, index) => (
            <div
              key={index}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  FAQ {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => deleteFaq(index)}
                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  value={faq.question}
                  onChange={(e) => updateFaq(index, 'question', e.target.value)}
                  placeholder="What is the square footage?"
                  className={inputClass}
                />
                <textarea
                  value={faq.answer}
                  onChange={(e) => updateFaq(index, 'answer', e.target.value)}
                  rows={2}
                  placeholder="The property is approximately 2,100 square feet of living space."
                  className={inputClass}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Variables */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Variable className="h-4 w-4 text-indigo-500" />
            <div>
              <h3 className="text-sm font-medium text-slate-700">
                Custom Variables
              </h3>
              <p className="text-xs text-slate-400">
                Key-value pairs available in scripts as {'{{key}}'}.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={addVariable}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-600"
          >
            <Plus className="h-4 w-4" />
            Add Variable
          </button>
        </div>

        {config.customVariables.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <Variable className="mx-auto mb-2 h-6 w-6 text-slate-300" />
            <p className="text-sm text-slate-500">
              No custom variables yet. Add key-value pairs for dynamic scripts.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {config.customVariables.map((variable, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              <input
                type="text"
                value={variable.key}
                onChange={(e) => updateVariable(index, 'key', e.target.value)}
                placeholder="variable_name"
                className={`w-40 ${inputClass}`}
              />
              <span className="text-sm text-slate-400">=</span>
              <input
                type="text"
                value={variable.value}
                onChange={(e) => updateVariable(index, 'value', e.target.value)}
                placeholder="value"
                className={`flex-1 ${inputClass}`}
              />
              <button
                type="button"
                onClick={() => deleteVariable(index)}
                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
