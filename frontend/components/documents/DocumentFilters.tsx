/**
 * DocumentFilters Component
 * Filter controls for document list
 */

'use client';

import React, { useState } from 'react';
import { DocumentFilters as FilterType } from '@/types/document';

interface DocumentFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
}

const SOURCE_SYSTEMS = ['Research Papers', 'Technical Docs', 'Case Studies', 'Internal Docs'];
const FILE_TYPES = ['PDF', 'DOCX', 'TXT', 'MD'];
const AVAILABLE_TAGS = ['RAG', 'AI', 'Vector DB', 'LLM', 'Best Practices', 'Tutorial', 'Implementation'];

export default function DocumentFilters({ filters, onFiltersChange }: DocumentFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilter = (key: keyof FilterType, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleArrayFilter = (key: 'source_systems' | 'file_types' | 'tags', value: string) => {
    const currentArray = (filters[key] as string[]) || [];
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value];
    updateFilter(key, newArray);
  };

  const clearAllFilters = () => {
    onFiltersChange({});
  };

  const activeFilterCount = [
    filters.search ? 1 : 0,
    filters.source_systems?.length || 0,
    filters.file_types?.length || 0,
    filters.tags?.length || 0,
    filters.date_range ? 1 : 0
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                {activeFilterCount} active
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear all
              </button>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg
                className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar - Always Visible */}
      <div className="px-4 py-3 border-b border-gray-200">
        <input
          type="text"
          placeholder="Search documents..."
          value={filters.search || ''}
          onChange={(e) => updateFilter('search', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
      </div>

      {/* Expandable Filters */}
      {isExpanded && (
        <div className="px-4 py-3 space-y-4">
          {/* Source Systems */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Source Systems
            </label>
            <div className="flex flex-wrap gap-2">
              {SOURCE_SYSTEMS.map((source) => (
                <button
                  key={source}
                  onClick={() => toggleArrayFilter('source_systems', source)}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    filters.source_systems?.includes(source)
                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {source}
                </button>
              ))}
            </div>
          </div>

          {/* File Types */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              File Types
            </label>
            <div className="flex flex-wrap gap-2">
              {FILE_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => toggleArrayFilter('file_types', type)}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    filters.file_types?.includes(type)
                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleArrayFilter('tags', tag)}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    filters.tags?.includes(tag)
                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
