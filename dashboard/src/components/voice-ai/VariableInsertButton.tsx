'use client';

import { useState, useRef, useEffect } from 'react';
import { BUILT_IN_VARIABLES, CustomVariable } from './types';

interface Props {
  customVariables: CustomVariable[];
  onInsert: (variable: string) => void;
}

export function VariableInsertButton({ customVariables, onInsert }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInsert = (variableKey: string) => {
    onInsert(`{{${variableKey}}}`);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-mautic-blue hover:text-mautic-blue-dark hover:bg-mautic-blue/5 rounded-lg transition"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Insert Variable
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
          {/* Built-in Variables */}
          <div className="p-2 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide px-2 py-1">
              Built-in Variables
            </p>
            <div className="space-y-0.5">
              {BUILT_IN_VARIABLES.map((variable) => (
                <button
                  key={variable.key}
                  type="button"
                  onClick={() => handleInsert(variable.key)}
                  className="w-full text-left px-2 py-2 rounded hover:bg-gray-50 transition group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-mautic-blue">
                      {`{{${variable.key}}}`}
                    </span>
                    <span className="text-xs text-gray-400 group-hover:text-gray-600">
                      {variable.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{variable.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Variables */}
          {customVariables.length > 0 && (
            <div className="p-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide px-2 py-1">
                Custom Variables
              </p>
              <div className="space-y-0.5">
                {customVariables.map((variable) => (
                  <button
                    key={variable.key}
                    type="button"
                    onClick={() => handleInsert(variable.key)}
                    className="w-full text-left px-2 py-2 rounded hover:bg-gray-50 transition group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm text-purple-600">
                        {`{{${variable.key}}}`}
                      </span>
                      <span className="text-xs text-gray-400 font-mono truncate max-w-[120px]">
                        {variable.value}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {customVariables.length === 0 && (
            <div className="p-3 text-center text-sm text-gray-500">
              Add custom variables below to use them here
            </div>
          )}
        </div>
      )}
    </div>
  );
}
