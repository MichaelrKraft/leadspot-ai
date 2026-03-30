/**
 * Query Page
 * Main AI search interface with query input and results
 */

'use client';

import React from 'react';
import { useQueryWithDemo } from '@/hooks/useQuery';
import QueryInput from '@/components/query/QueryInput';
import QueryResult from '@/components/query/QueryResult';

// Example queries shown as suggestions in the empty state
const EXAMPLE_QUERIES = [
  'What documents discuss compliance requirements?',
  'What are our standard operating procedures?',
  'How do we handle customer data?',
  'What training materials are available?',
  'What are our quality assurance guidelines?',
];

export default function QueryPage() {
  const { submitQuery, isLoading, error, response, clearResponse } = useQueryWithDemo();

  const handleExampleClick = (query: string) => {
    submitQuery({ query });
  };

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            AI Knowledge Search
          </h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
            Ask questions and get AI-powered answers from your knowledge base
          </p>
        </div>

        {/* Query Input */}
        <QueryInput onSubmit={submitQuery} isLoading={isLoading} />

        {/* Error Display */}
        {error && (
          <div className="mt-6 max-w-4xl mx-auto bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-800 dark:text-red-400">Error</h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="mt-6 max-w-4xl mx-auto bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-8">
            <div className="flex flex-col items-center justify-center gap-4">
              <svg className="animate-spin h-10 w-10 text-blue-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-lg text-gray-600 dark:text-gray-300">Searching knowledge base...</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">This may take a few seconds</p>
            </div>
          </div>
        )}

        {/* Query Result */}
        {response && !isLoading && (
          <QueryResult
            response={response}
            onClear={clearResponse}
            onFollowUp={(question) => {
              // Clear previous results and submit new query
              clearResponse();
              submitQuery({ query: question });
            }}
          />
        )}

        {/* Example Queries */}
        {!response && !isLoading && (
          <div className="mt-8 max-w-4xl mx-auto">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 text-center">
              Try an example query:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLE_QUERIES.map((query, index) => (
                <button
                  key={index}
                  onClick={() => handleExampleClick(query)}
                  className="px-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-gray-700 dark:text-gray-300 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 dark:hover:bg-blue-900/20 dark:hover:border-blue-700 dark:hover:text-blue-400 transition-colors"
                >
                  {query}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Help Text */}
        {!response && !isLoading && !error && (
          <div className="mt-8 max-w-4xl mx-auto">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-3">
                How to use AI Knowledge Search
              </h3>
              <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Ask natural language questions about your documents</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Get AI-generated answers with source citations</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Use filters to narrow down your search to specific sources</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Click on source citations to view full documents</span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
