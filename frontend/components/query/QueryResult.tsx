/**
 * QueryResult Component
 * Displays AI-generated answer with source citations
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { QueryResponse } from '@/types/query';
import SourceCard from './SourceCard';
import DocumentPreviewCard from './DocumentPreviewCard';

interface QueryResultProps {
  response: QueryResponse;
  onClear?: () => void;
  onFollowUp?: (question: string) => void;
}

export default function QueryResult({ response, onClear, onFollowUp }: QueryResultProps) {
  const formatResponseTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'text-gray-500';
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceLabel = (confidence?: number) => {
    if (!confidence) return 'Unknown';
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  // Add citation numbers to answer text
  const addCitations = (text: string, sources: typeof response.sources) => {
    if (sources.length === 0) return text;

    // For now, append citation numbers at the end of relevant sentences
    // In a production system, this would be done by the LLM
    let result = text;
    sources.forEach((source, index) => {
      const citationNum = index + 1;
      // Add citation reference if source title words appear in the answer
      const titleWords = source.title.toLowerCase().split(' ').filter(w => w.length > 4);
      titleWords.forEach(word => {
        if (result.toLowerCase().includes(word)) {
          // Find sentences containing this word and add citation
          const regex = new RegExp(`([^.!?]*${word}[^.!?]*[.!?])`, 'gi');
          result = result.replace(regex, (match) => {
            if (!match.includes(`[${citationNum}]`)) {
              return match.trim().slice(0, -1) + `[${citationNum}]` + match.slice(-1);
            }
            return match;
          });
        }
      });
    });
    return result;
  };

  return (
    <div className="w-full max-w-4xl mx-auto mt-6 space-y-4">
      {/* Quick Source Pills - ABOVE answer (Perplexity-style) */}
      {response.sources.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {response.sources.slice(0, 5).map((source, index) => (
            <a
              key={source.document_id}
              href={source.source_url || source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800/60 hover:bg-gray-200 dark:hover:bg-gray-700/60 rounded-lg border border-gray-200 dark:border-gray-700 transition-colors group"
            >
              <span className="flex items-center justify-center w-5 h-5 text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded">
                {index + 1}
              </span>
              <span className="text-sm text-gray-700 dark:text-gray-300 max-w-[150px] truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {source.title}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {Math.round((source.relevance_score || 0) * 100)}%
              </span>
            </a>
          ))}
          {response.sources.length > 5 && (
            <span className="flex-shrink-0 flex items-center px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
              +{response.sources.length - 5} more
            </span>
          )}
        </div>
      )}

      {/* Low Relevance Warning */}
      {response.confidence !== undefined && response.confidence < 0.45 && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>Low confidence - results may not be directly relevant to your question.</span>
          </div>
        </div>
      )}

      {/* Answer Section */}
      <div className="bg-white dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/50 rounded-xl">
        {/* Answer Content - Larger text, cleaner */}
        <div className="px-6 py-5">
          <p className="text-lg text-gray-800 dark:text-gray-100 leading-relaxed whitespace-pre-wrap">
            {addCitations(response.answer, response.sources)}
          </p>
        </div>

        {/* Metadata bar - Subtle */}
        <div className="px-6 py-2 border-t border-gray-100 dark:border-gray-700/30 flex items-center justify-between text-xs text-gray-500 dark:text-gray-500">
          <div className="flex items-center gap-3">
            {response.confidence !== undefined && (
              <span className={getConfidenceColor(response.confidence)}>
                {Math.round(response.confidence * 100)}% confidence
              </span>
            )}
            <span>{formatResponseTime(response.response_time_ms)}</span>
          </div>
          {onClear && (
            <button
              onClick={onClear}
              className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Document Sources - Rich Preview Cards (Google Drive style) */}
      {response.sources.length > 0 && (
        <div className="bg-white dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/50 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  Sources ({response.sources.length})
                </h3>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Click to open
              </span>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {response.sources.map((source) => (
              <DocumentPreviewCard
                key={source.document_id}
                title={source.title}
                source_system={source.source_system}
                mime_type={source.mime_type}
                source_url={source.source_url || source.url}
                relevance_score={source.relevance_score}
                excerpt={source.excerpt}
                author={source.author}
              />
            ))}
          </div>
        </div>
      )}

      {/* Follow-up Questions Section */}
      {response.follow_up_questions && response.follow_up_questions.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800/50 rounded-lg shadow-sm">
          <div className="px-6 py-4">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Continue exploring
              </h3>
            </div>
            <div className="space-y-2">
              {response.follow_up_questions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => onFollowUp?.(question)}
                  className="w-full text-left px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-lg hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </span>
                    <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-purple-700 dark:group-hover:text-purple-300">
                      {question}
                    </span>
                    <svg className="w-4 h-4 ml-auto text-gray-400 group-hover:text-purple-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Research Mode Indicator */}
      {response.research_mode && response.sub_queries && response.sub_queries.length > 1 && (
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-purple-700 dark:text-purple-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">Research Mode</span>
            <span className="text-purple-600 dark:text-purple-500">
              — This answer combines insights from {response.sub_queries.length} sub-queries
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
