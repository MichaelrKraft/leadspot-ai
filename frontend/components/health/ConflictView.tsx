// Conflict Visualization Component

'use client';

import { FileText, ArrowRight } from 'lucide-react';
import clsx from 'clsx';
import type { ConflictDetail } from '@/types/health';

interface ConflictViewProps {
  conflict: ConflictDetail;
  onResolve?: (resolution: string) => void;
}

export default function ConflictView({ conflict, onResolve }: ConflictViewProps) {
  // Group sections by document
  const sections = conflict.conflicting_sections;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Conflicting Information
        </h3>
        <span className="text-sm text-gray-500">
          {sections.length} conflicting sections
        </span>
      </div>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sections.map((section, index) => (
          <div
            key={index}
            className="border border-red-200 rounded-lg p-4 bg-red-50"
          >
            {/* Document Info */}
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-red-200">
              <FileText className="w-4 h-4 text-red-600" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  Document {section.document_id}
                </div>
                <div className="text-xs text-gray-600">
                  Section: {section.section}
                </div>
              </div>
            </div>

            {/* Conflicting Content */}
            <div className="relative">
              <div className="text-sm text-gray-700 leading-relaxed">
                {section.content}
              </div>

              {/* Highlight marker */}
              <div className="absolute -left-2 top-0 bottom-0 w-1 bg-red-500 rounded-full"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Comparison Indicator (for 2 sections) */}
      {sections.length === 2 && (
        <div className="flex items-center justify-center -my-2">
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-red-300 rounded-full shadow-sm">
            <FileText className="w-4 h-4 text-red-600" />
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-red-700">
              Conflicting Versions
            </span>
            <ArrowRight className="w-4 h-4 text-gray-400" />
            <FileText className="w-4 h-4 text-red-600" />
          </div>
        </div>
      )}

      {/* Suggested Resolution */}
      {conflict.suggested_resolution && (
        <div className="border border-green-200 rounded-lg p-4 bg-green-50">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                <span className="text-white text-xs font-bold">✓</span>
              </div>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-green-900 mb-2">
                Suggested Resolution
              </h4>
              <p className="text-sm text-green-800 leading-relaxed">
                {conflict.suggested_resolution}
              </p>
            </div>
          </div>

          {/* Action Button */}
          {onResolve && (
            <div className="mt-4 pt-4 border-t border-green-200">
              <button
                onClick={() => onResolve(conflict.suggested_resolution!)}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
              >
                Apply This Resolution
              </button>
            </div>
          )}
        </div>
      )}

      {/* Manual Resolution Option */}
      {!conflict.suggested_resolution && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">
            Manual Resolution Required
          </h4>
          <p className="text-sm text-gray-600 mb-3">
            Review the conflicting sections above and determine which version is correct,
            or merge the information appropriately.
          </p>
          <div className="flex gap-2">
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              View Full Documents
            </button>
            <button className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
              Create Resolution Task
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
