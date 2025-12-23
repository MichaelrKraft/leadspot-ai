/**
 * QueryInput Component
 * Enhanced textarea with suggestions and filters
 */

'use client';

import React, { useState, KeyboardEvent } from 'react';
import { QueryRequest, QueryFilters, QuerySuggestion } from '@/types/query';

const QUERY_SUGGESTIONS: QuerySuggestion[] = [
  { text: 'How do I implement a vector database?', category: 'Technical' },
  { text: 'What are best practices for RAG systems?', category: 'Best Practices' },
  { text: 'Explain semantic search', category: 'Concepts' },
  { text: 'How to optimize embedding performance?', category: 'Performance' },
  { text: 'What is the difference between RAG and fine-tuning?', category: 'Concepts' }
];

interface QueryInputProps {
  onSubmit: (request: QueryRequest) => void;
  isLoading?: boolean;
}

export default function QueryInput({ onSubmit, isLoading = false }: QueryInputProps) {
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filters, setFilters] = useState<QueryFilters>({});
  const [researchMode, setResearchMode] = useState(false);

  const handleSubmit = () => {
    if (query.trim() && !isLoading) {
      onSubmit({ query: query.trim(), filters, research_mode: researchMode });
      setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const selectSuggestion = (suggestion: QuerySuggestion) => {
    setQuery(suggestion.text);
    setShowSuggestions(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Query Input - Large, prominent search box */}
      <div className="relative">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => !query && setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your knowledge base..."
          className="w-full px-6 py-5 pr-28 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[140px] text-lg font-sans transition-all shadow-sm focus:shadow-md"
          disabled={isLoading}
        />

        {/* Submit Button - Larger and more prominent */}
        <button
          onClick={handleSubmit}
          disabled={!query.trim() || isLoading}
          className="absolute bottom-4 right-4 px-6 py-3 bg-blue-600 text-white text-base font-medium rounded-xl hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Searching...
            </span>
          ) : (
            'Search'
          )}
        </button>
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && !query && (
        <div className="mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-lg shadow-lg overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-white/10">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Example queries</p>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {QUERY_SUGGESTIONS.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => selectSuggestion(suggestion)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                <p className="text-sm text-gray-900 dark:text-white">{suggestion.text}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{suggestion.category}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Research Mode Toggle & Quick Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-4">
        {/* Research Mode Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setResearchMode(!researchMode)}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-all ${
              researchMode
                ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-400'
                : 'bg-white dark:bg-white/5 border-gray-300 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-purple-300 dark:hover:border-purple-700'
            }`}
            title="Research Mode breaks complex questions into sub-queries for deeper analysis"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Research Mode
            {researchMode && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-purple-200 dark:bg-purple-800 rounded">ON</span>
            )}
          </button>
          {researchMode && (
            <span className="text-xs text-purple-600 dark:text-purple-400">
              Complex queries will be broken into sub-questions
            </span>
          )}
        </div>

        {/* Quick Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Filters:</span>
          {['Research Papers', 'Technical Docs', 'Case Studies'].map((source) => (
            <button
              key={source}
              onClick={() => {
                const currentSources = filters.sources || [];
                const newSources = currentSources.includes(source)
                  ? currentSources.filter(s => s !== source)
                  : [...currentSources, source];
                setFilters({ ...filters, sources: newSources });
              }}
              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                filters.sources?.includes(source)
                  ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400'
                  : 'bg-white dark:bg-white/5 border-gray-300 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-white/20'
              }`}
            >
              {source}
            </button>
          ))}
        </div>
      </div>

      {/* Active Filters Display */}
      {filters.sources && filters.sources.length > 0 && (
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Filtering by: {filters.sources.join(', ')}
        </div>
      )}
    </div>
  );
}
