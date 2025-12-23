/**
 * Document Detail Page
 * View full document content and metadata
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { useDocument } from '@/hooks/useDocuments';

interface DocumentDetailPageProps {
  params: {
    id: string;
  };
}

export default function DocumentDetailPage({ params }: DocumentDetailPageProps) {
  const { document, isLoading, error } = useDocument(params.id);

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm">
          <Link href="/documents" className="text-blue-600 hover:text-blue-700 hover:underline">
            Documents
          </Link>
          <svg className="h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-gray-600">
            {isLoading ? 'Loading...' : document?.title || 'Document'}
          </span>
        </nav>

        {/* Loading State */}
        {isLoading && (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <svg className="mx-auto h-8 w-8 animate-spin text-blue-600" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p className="mt-4 text-gray-600">Loading document...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
            <svg
              className="mx-auto mb-4 h-12 w-12 text-red-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <h3 className="mb-2 text-lg font-medium text-red-800">Error loading document</h3>
            <p className="text-red-700">{error}</p>
            <Link
              href="/documents"
              className="mt-4 inline-block rounded-md bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
            >
              Back to Documents
            </Link>
          </div>
        )}

        {/* Document Content */}
        {document && !isLoading && !error && (
          <div className="space-y-6">
            {/* Header */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h1 className="mb-4 text-3xl font-bold text-gray-900">{document.title}</h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                {document.author && (
                  <>
                    <span className="flex items-center gap-1">
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {document.author}
                    </span>
                    <span className="text-gray-300">•</span>
                  </>
                )}
                <span className="flex items-center gap-1">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {formatDate(document.created_at)}
                </span>
              </div>

              {document.tags && document.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {document.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Metadata</h2>
              <dl className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                <div>
                  <dt className="mb-1 font-medium text-gray-700">Source System</dt>
                  <dd className="text-gray-900">{document.source_system}</dd>
                </div>
                {document.metadata.file_type && (
                  <div>
                    <dt className="mb-1 font-medium text-gray-700">File Type</dt>
                    <dd className="text-gray-900">{document.metadata.file_type}</dd>
                  </div>
                )}
                {document.metadata.file_size && (
                  <div>
                    <dt className="mb-1 font-medium text-gray-700">File Size</dt>
                    <dd className="text-gray-900">{formatFileSize(document.metadata.file_size)}</dd>
                  </div>
                )}
                {document.metadata.page_count && (
                  <div>
                    <dt className="mb-1 font-medium text-gray-700">Pages</dt>
                    <dd className="text-gray-900">{document.metadata.page_count}</dd>
                  </div>
                )}
                {document.metadata.language && (
                  <div>
                    <dt className="mb-1 font-medium text-gray-700">Language</dt>
                    <dd className="text-gray-900">{document.metadata.language.toUpperCase()}</dd>
                  </div>
                )}
                {document.metadata.last_indexed && (
                  <div>
                    <dt className="mb-1 font-medium text-gray-700">Last Indexed</dt>
                    <dd className="text-gray-900">{formatDate(document.metadata.last_indexed)}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Summary */}
            {document.metadata.summary && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
                <h2 className="mb-3 text-lg font-semibold text-blue-900">Summary</h2>
                <p className="leading-relaxed text-blue-800">{document.metadata.summary}</p>
              </div>
            )}

            {/* Content */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Content</h2>
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-sans leading-relaxed text-gray-800">
                  {document.content}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
