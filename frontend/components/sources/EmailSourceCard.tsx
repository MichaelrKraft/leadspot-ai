'use client';

import { useState } from 'react';

interface EmailSourceProps {
  documentId: string;
  title: string;  // Email subject
  excerpt: string;  // Email content snippet
  url?: string;  // Gmail link
  relevanceScore: number;
  sourceSystem: string;
  // Email-specific fields parsed from content
  fromEmail?: string;
  fromName?: string;
  date?: string;
}

export default function EmailSourceCard({
  documentId,
  title,
  excerpt,
  url,
  relevanceScore,
  sourceSystem,
  fromEmail,
  fromName,
  date,
}: EmailSourceProps) {
  const [expanded, setExpanded] = useState(false);

  // Parse email metadata from excerpt if not provided
  const parseEmailMetadata = () => {
    if (fromEmail && date) return { fromEmail, fromName, date };

    // Try to extract from excerpt (format: "Subject: ...\nFrom: Name <email>\nTo: ...\nDate: ...")
    const fromMatch = excerpt.match(/From:\s*([^<\n]*)\s*<?([^>\n]*)>?/i);
    const dateMatch = excerpt.match(/Date:\s*([^\n]+)/i);

    return {
      fromEmail: fromMatch?.[2] || fromEmail,
      fromName: fromMatch?.[1]?.trim() || fromName,
      date: dateMatch?.[1] || date,
    };
  };

  const metadata = parseEmailMetadata();

  // Format the date nicely
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown date';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Get relevance color
  const getRelevanceColor = (score: number) => {
    if (score >= 0.8) return 'text-green-400';
    if (score >= 0.6) return 'text-yellow-400';
    return 'text-gray-400';
  };

  // Strip email headers from excerpt for display
  const getCleanExcerpt = () => {
    // Remove header lines and get just the body
    const lines = excerpt.split('\n');
    const bodyStartIndex = lines.findIndex(line =>
      line.trim() === '' &&
      lines.slice(0, lines.indexOf(line)).some(l => l.startsWith('From:') || l.startsWith('Subject:'))
    );

    if (bodyStartIndex > 0) {
      return lines.slice(bodyStartIndex + 1).join('\n').trim();
    }
    return excerpt;
  };

  return (
    <div className="rounded-lg border border-gray-800 bg-background-tertiary overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {/* Email Icon */}
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500/20 to-yellow-500/20 flex items-center justify-center flex-shrink-0 border border-red-500/30">
              <svg className="w-5 h-5 text-red-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 18h-2V9.25L12 13 6 9.25V18H4V6h1.2l6.8 4.25L18.8 6H20v12zm0-14H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"/>
              </svg>
            </div>

            <div className="min-w-0">
              {/* Subject */}
              <h4 className="text-white font-medium truncate" title={title}>
                {title || '(No Subject)'}
              </h4>

              {/* From & Date */}
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
                <span className="truncate">
                  {metadata.fromName || metadata.fromEmail || 'Unknown sender'}
                </span>
                {metadata.date && (
                  <>
                    <span className="text-gray-600">-</span>
                    <span className="flex-shrink-0">{formatDate(metadata.date)}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Relevance Score */}
          <div className="flex-shrink-0 text-right">
            <span className={`text-sm font-medium ${getRelevanceColor(relevanceScore)}`}>
              {Math.round(relevanceScore * 100)}%
            </span>
            <p className="text-xs text-gray-500">match</p>
          </div>
        </div>
      </div>

      {/* Content Preview */}
      <div className="p-4">
        <p className={`text-sm text-gray-300 ${expanded ? '' : 'line-clamp-3'}`}>
          {getCleanExcerpt()}
        </p>

        {excerpt.length > 200 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-blue-400 hover:text-blue-300 mt-2"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {/* Footer */}
      {url && (
        <div className="px-4 py-3 bg-background-secondary border-t border-gray-800">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Open in Gmail
          </a>
        </div>
      )}
    </div>
  );
}

// Helper component for email citations in answer text
export function EmailCitation({
  subject,
  sender,
  date,
  onClick,
}: {
  subject: string;
  sender?: string;
  date?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/10 text-red-400 text-sm hover:bg-red-500/20 transition-colors"
    >
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 18h-2V9.25L12 13 6 9.25V18H4V6h1.2l6.8 4.25L18.8 6H20v12zm0-14H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"/>
      </svg>
      <span className="truncate max-w-[200px]">
        {sender ? `Email from ${sender}` : subject}
      </span>
      {date && <span className="text-gray-500 text-xs">({date})</span>}
    </button>
  );
}
