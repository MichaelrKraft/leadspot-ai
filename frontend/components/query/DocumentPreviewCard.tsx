/**
 * DocumentPreviewCard Component
 * Rich Google Drive-style document preview cards for query results
 */

'use client';

import React from 'react';

interface DocumentPreviewCardProps {
  title: string;
  source_system?: string;  // gmail, google_drive, upload
  mime_type?: string;      // application/pdf, etc.
  source_url?: string;     // URL to open document
  relevance_score?: number;
  excerpt?: string;
  author?: string;
}

// Get document icon with Google Drive-style colors
function getDocumentIcon(source_system?: string, mime_type?: string) {
  // Gmail/Email
  if (source_system === 'gmail') {
    return (
      <div className="w-12 h-12 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
        <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
      </div>
    );
  }

  if (mime_type) {
    // PDF - Red
    if (mime_type.includes('pdf')) {
      return (
        <div className="w-12 h-12 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
          <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13zm-3.5 7.5c0 .83-.67 1.5-1.5 1.5H7v-5h2c.83 0 1.5.67 1.5 1.5v2zm4.5.5c0 .83-.67 1.5-1.5 1.5h-2v-5h2c.83 0 1.5.67 1.5 1.5v2zm4.5-1.5h-1v1h1v1.5h-2.5v-5H19v1.5h-1v1z"/>
          </svg>
        </div>
      );
    }

    // Google Docs - Blue
    if (mime_type.includes('document') || mime_type.includes('word') || mime_type.includes('google-apps.document')) {
      return (
        <div className="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
          <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
      );
    }

    // Sheets - Green
    if (mime_type.includes('spreadsheet') || mime_type.includes('excel') || mime_type.includes('sheet')) {
      return (
        <div className="w-12 h-12 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
          <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125" />
          </svg>
        </div>
      );
    }

    // Slides - Orange/Yellow
    if (mime_type.includes('presentation') || mime_type.includes('powerpoint') || mime_type.includes('slides')) {
      return (
        <div className="w-12 h-12 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
          <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
          </svg>
        </div>
      );
    }

    // Images
    if (mime_type.includes('image')) {
      return (
        <div className="w-12 h-12 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
          <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
        </div>
      );
    }
  }

  // Default Google Drive file
  if (source_system === 'google_drive') {
    return (
      <div className="w-12 h-12 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center">
        <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      </div>
    );
  }

  // Default document
  return (
    <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
      <svg className="w-6 h-6 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    </div>
  );
}

// Get source label
function getSourceLabel(source_system?: string) {
  switch (source_system) {
    case 'gmail': return 'Gmail';
    case 'google_drive': return 'Google Drive';
    case 'upload': return 'Uploaded';
    default: return 'Document';
  }
}

// Format excerpt to show preview content
function formatExcerpt(excerpt?: string, maxLength: number = 120) {
  if (!excerpt) return '';
  // Clean up whitespace and newlines
  const cleaned = excerpt.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.substring(0, maxLength).trim() + '...';
}

export default function DocumentPreviewCard({
  title,
  source_system,
  mime_type,
  source_url,
  relevance_score,
  excerpt,
  author
}: DocumentPreviewCardProps) {
  const handleClick = () => {
    if (source_url) {
      window.open(source_url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`
        group flex gap-4 p-4
        bg-white dark:bg-gray-800/60
        border border-gray-200 dark:border-gray-700/50
        rounded-xl
        transition-all duration-200
        ${source_url ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md' : ''}
      `}
    >
      {/* Document Icon */}
      <div className="flex-shrink-0">
        {getDocumentIcon(source_system, mime_type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Title */}
        <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
          {title}
        </h4>

        {/* Meta info */}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {getSourceLabel(source_system)}
          </span>
          {author && (
            <>
              <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]">
                {author}
              </span>
            </>
          )}
          {relevance_score !== undefined && (
            <>
              <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
              <span className={`text-xs font-medium ${
                relevance_score >= 0.7 ? 'text-green-600 dark:text-green-400' :
                relevance_score >= 0.5 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-gray-500 dark:text-gray-400'
              }`}>
                {Math.round(relevance_score * 100)}% match
              </span>
            </>
          )}
        </div>

        {/* Excerpt preview */}
        {excerpt && (
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
            {formatExcerpt(excerpt, 150)}
          </p>
        )}
      </div>

      {/* Open indicator */}
      {source_url && (
        <div className="flex-shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </div>
      )}
    </div>
  );
}
