'use client';

import { useState, useEffect } from 'react';
import { HttpTool, HttpToolParameter } from './types';

interface Props {
  tool: HttpTool | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (tool: HttpTool) => void;
}

const DEFAULT_TOOL: HttpTool = {
  id: '',
  name: '',
  description: '',
  url: '',
  method: 'POST',
  headers: {},
  bodyTemplate: '',
  parameters: [],
};

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE'] as const;

export function HttpToolEditor({ tool, isOpen, onClose, onSave }: Props) {
  const [formData, setFormData] = useState<HttpTool>(DEFAULT_TOOL);
  const [headerKey, setHeaderKey] = useState('');
  const [headerValue, setHeaderValue] = useState('');

  useEffect(() => {
    if (tool) {
      setFormData(tool);
    } else {
      setFormData({ ...DEFAULT_TOOL, id: `tool_${Date.now()}` });
    }
  }, [tool, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const addHeader = () => {
    if (headerKey && headerValue) {
      setFormData({
        ...formData,
        headers: { ...formData.headers, [headerKey]: headerValue },
      });
      setHeaderKey('');
      setHeaderValue('');
    }
  };

  const removeHeader = (key: string) => {
    const newHeaders = { ...formData.headers };
    delete newHeaders[key];
    setFormData({ ...formData, headers: newHeaders });
  };

  const addParameter = () => {
    setFormData({
      ...formData,
      parameters: [
        ...formData.parameters,
        { name: '', type: 'string', description: '', required: true },
      ],
    });
  };

  const updateParameter = (index: number, updates: Partial<HttpToolParameter>) => {
    const newParams = [...formData.parameters];
    newParams[index] = { ...newParams[index], ...updates };
    setFormData({ ...formData, parameters: newParams });
  };

  const removeParameter = (index: number) => {
    setFormData({
      ...formData,
      parameters: formData.parameters.filter((_, i) => i !== index),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />

        {/* Modal */}
        <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl transform transition-all">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">
              {tool ? 'Edit HTTP Tool' : 'Add HTTP Tool'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Name & Description */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tool Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Book Appointment"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mautic-blue focus:border-mautic-blue transition text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Method *
                </label>
                <select
                  value={formData.method}
                  onChange={(e) => setFormData({ ...formData, method: e.target.value as HttpTool['method'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mautic-blue focus:border-mautic-blue transition text-sm"
                >
                  {HTTP_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Help the AI understand when to use this tool
              </p>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Books an appointment on the calendar when the caller wants to schedule a meeting"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mautic-blue focus:border-mautic-blue transition text-sm"
              />
            </div>

            {/* URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Endpoint URL *
              </label>
              <input
                type="url"
                required
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://api.example.com/appointments"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mautic-blue focus:border-mautic-blue transition text-sm font-mono"
              />
            </div>

            {/* Headers */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Headers
              </label>
              <div className="space-y-2">
                {Object.entries(formData.headers).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <code className="text-sm text-gray-700">{key}:</code>
                    <code className="text-sm text-gray-500 flex-1 truncate">{value}</code>
                    <button
                      type="button"
                      onClick={() => removeHeader(key)}
                      className="p-1 text-gray-400 hover:text-red-500 transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={headerKey}
                    onChange={(e) => setHeaderKey(e.target.value)}
                    placeholder="Header name"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    value={headerValue}
                    onChange={(e) => setHeaderValue(e.target.value)}
                    placeholder="Header value"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={addHeader}
                    disabled={!headerKey || !headerValue}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Parameters */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Parameters
                </label>
                <button
                  type="button"
                  onClick={addParameter}
                  className="text-sm text-mautic-blue hover:text-mautic-blue-dark transition"
                >
                  + Add Parameter
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Define what information the AI should collect from the caller
              </p>

              {formData.parameters.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center text-sm text-gray-500">
                  No parameters. Click "Add Parameter" to define what the AI should collect.
                </div>
              ) : (
                <div className="space-y-3">
                  {formData.parameters.map((param, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-3">
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <input
                          type="text"
                          value={param.name}
                          onChange={(e) => updateParameter(index, { name: e.target.value.replace(/\s/g, '_') })}
                          placeholder="param_name"
                          className="px-2 py-1.5 border border-gray-300 rounded text-sm font-mono"
                        />
                        <select
                          value={param.type}
                          onChange={(e) => updateParameter(index, { type: e.target.value as HttpToolParameter['type'] })}
                          className="px-2 py-1.5 border border-gray-300 rounded text-sm"
                        >
                          <option value="string">String</option>
                          <option value="number">Number</option>
                          <option value="boolean">Boolean</option>
                        </select>
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={param.required}
                              onChange={(e) => updateParameter(index, { required: e.target.checked })}
                              className="rounded border-gray-300 text-mautic-blue focus:ring-mautic-blue"
                            />
                            Required
                          </label>
                          <button
                            type="button"
                            onClick={() => removeParameter(index)}
                            className="p-1 text-gray-400 hover:text-red-500 transition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={param.description}
                        onChange={(e) => updateParameter(index, { description: e.target.value })}
                        placeholder="Description (helps AI understand what to ask for)"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Body Template */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Request Body Template
              </label>
              <p className="text-xs text-gray-500 mb-2">
                JSON template with {'{{parameter_name}}'} placeholders
              </p>
              <textarea
                value={formData.bodyTemplate}
                onChange={(e) => setFormData({ ...formData, bodyTemplate: e.target.value })}
                placeholder={`{
  "date": "{{date}}",
  "time": "{{time}}",
  "name": "{{caller_name}}",
  "phone": "{{caller_phone}}"
}`}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mautic-blue focus:border-mautic-blue transition text-sm font-mono"
              />
            </div>
          </form>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={!formData.name || !formData.url || !formData.description}
              className="px-4 py-2 text-sm font-medium text-white bg-mautic-blue hover:bg-mautic-blue-dark rounded-lg transition disabled:opacity-50"
            >
              {tool ? 'Save Changes' : 'Add Tool'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
