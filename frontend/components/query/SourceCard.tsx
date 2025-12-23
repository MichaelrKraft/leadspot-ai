/**
 * SourceCard Component
 * Visual thumbnail card for document sources in query results
 */

'use client';

import React from 'react';

interface SourceCardProps {
  title: string;
  source_system?: string;  // gmail, google_drive, upload
  mime_type?: string;      // application/pdf, etc.
  source_url?: string;     // URL to open document
  relevance_score?: number;
  excerpt?: string;
}

// File type icon based on mime_type or source_system
function getFileIcon(source_system?: string, mime_type?: string) {
  // Email icon for gmail
  if (source_system === 'gmail') {
    return (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="4" width="20" height="16" rx="2" className="fill-red-100 dark:fill-red-900/30 stroke-red-500" />
        <path d="M22 6L12 13L2 6" className="stroke-red-500" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // Detect file type from mime_type
  if (mime_type) {
    // PDF
    if (mime_type.includes('pdf')) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" className="fill-red-100 dark:fill-red-900/30 stroke-red-600" />
          <polyline points="14 2 14 8 20 8" className="stroke-red-600" />
          <text x="7" y="17" className="fill-red-600 text-[6px] font-bold">PDF</text>
        </svg>
      );
    }

    // Word docs
    if (mime_type.includes('word') || mime_type.includes('document')) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" className="fill-blue-100 dark:fill-blue-900/30 stroke-blue-600" />
          <polyline points="14 2 14 8 20 8" className="stroke-blue-600" />
          <line x1="8" y1="13" x2="16" y2="13" className="stroke-blue-600" />
          <line x1="8" y1="17" x2="14" y2="17" className="stroke-blue-600" />
        </svg>
      );
    }

    // Spreadsheets
    if (mime_type.includes('spreadsheet') || mime_type.includes('excel') || mime_type.includes('sheet')) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" className="fill-green-100 dark:fill-green-900/30 stroke-green-600" />
          <polyline points="14 2 14 8 20 8" className="stroke-green-600" />
          <rect x="7" y="12" width="10" height="6" className="stroke-green-600" />
          <line x1="7" y1="15" x2="17" y2="15" className="stroke-green-600" />
          <line x1="11" y1="12" x2="11" y2="18" className="stroke-green-600" />
        </svg>
      );
    }

    // Presentations
    if (mime_type.includes('presentation') || mime_type.includes('powerpoint')) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" className="fill-orange-100 dark:fill-orange-900/30 stroke-orange-600" />
          <polyline points="14 2 14 8 20 8" className="stroke-orange-600" />
          <rect x="7" y="12" width="10" height="6" rx="1" className="stroke-orange-600" />
        </svg>
      );
    }

    // Images
    if (mime_type.includes('image')) {
      return (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" className="fill-purple-100 dark:fill-purple-900/30 stroke-purple-600" />
          <circle cx="8.5" cy="8.5" r="1.5" className="fill-purple-600" />
          <path d="M21 15l-5-5L5 21" className="stroke-purple-600" />
        </svg>
      );
    }
  }

  // Default Google Drive icon
  if (source_system === 'google_drive') {
    return (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" className="fill-yellow-100 dark:fill-yellow-900/30 stroke-yellow-600" />
        <polyline points="14 2 14 8 20 8" className="stroke-yellow-600" />
      </svg>
    );
  }

  // Default upload/document icon
  return (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" className="fill-gray-100 dark:fill-gray-800 stroke-gray-500" />
      <polyline points="14 2 14 8 20 8" className="stroke-gray-500" />
    </svg>
  );
}

// Get source badge text and color
function getSourceBadge(source_system?: string) {
  switch (source_system) {
    case 'gmail':
      return { text: 'Gmail', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
    case 'google_drive':
      return { text: 'Drive', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' };
    case 'upload':
      return { text: 'Upload', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' };
    default:
      return { text: 'Doc', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' };
  }
}

// Truncate title to fit card
function truncateTitle(title: string, maxLength: number = 40) {
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength - 3) + '...';
}

export default function SourceCard({
  title,
  source_system,
  mime_type,
  source_url,
  relevance_score,
  excerpt
}: SourceCardProps) {
  const badge = getSourceBadge(source_system);

  const handleClick = () => {
    if (source_url) {
      window.open(source_url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`
        flex-shrink-0 w-32 h-36
        bg-white dark:bg-gray-800
        border border-gray-200 dark:border-white/10
        rounded-lg p-3
        flex flex-col items-center
        transition-all duration-200
        ${source_url ? 'cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md hover:scale-105' : ''}
      `}
      title={excerpt ? `${title}\n\n${excerpt}` : title}
    >
      {/* File Type Icon */}
      <div className="mb-2">
        {getFileIcon(source_system, mime_type)}
      </div>

      {/* Title */}
      <p className="text-xs text-gray-900 dark:text-gray-100 text-center font-medium leading-tight line-clamp-2 mb-auto">
        {truncateTitle(title, 35)}
      </p>

      {/* Source Badge */}
      <div className="mt-2 flex items-center gap-1">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badge.color}`}>
          {badge.text}
        </span>
        {relevance_score !== undefined && (
          <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
            {Math.round(relevance_score * 100)}%
          </span>
        )}
      </div>
    </div>
  );
}
