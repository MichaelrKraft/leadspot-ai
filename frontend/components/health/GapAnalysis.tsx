// Knowledge Gaps Display Component

'use client';

import { HelpCircle, TrendingUp, Search, Lightbulb } from 'lucide-react';
import clsx from 'clsx';
import type { GapAnalysis as GapAnalysisType } from '@/types/health';

interface GapAnalysisProps {
  analysis: GapAnalysisType;
  className?: string;
}

export default function GapAnalysis({ analysis, className }: GapAnalysisProps) {
  // Sort topics by gap count (descending)
  const sortedTopics = [...analysis.topics_with_gaps].sort(
    (a, b) => b.gap_count - a.gap_count
  );

  // Filter query patterns without answers
  const unansweredQueries = analysis.query_patterns.filter(p => !p.has_answer);

  return (
    <div className={clsx('space-y-6', className)}>
      {/* Topics with Gaps */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <HelpCircle className="w-5 h-5 text-yellow-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Topics with Coverage Gaps
          </h3>
        </div>

        <div className="space-y-3">
          {sortedTopics.slice(0, 5).map((topic, index) => (
            <div
              key={index}
              className="border border-yellow-200 rounded-lg p-4 bg-yellow-50"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{topic.topic}</h4>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-sm text-gray-600">
                      {topic.gap_count} gap{topic.gap_count !== 1 ? 's' : ''} identified
                    </span>
                    <span className="text-sm font-medium text-yellow-700">
                      {topic.coverage_percentage}% coverage
                    </span>
                  </div>
                </div>

                {/* Coverage Badge */}
                <div
                  className={clsx(
                    'px-3 py-1 rounded-full text-xs font-medium',
                    topic.coverage_percentage >= 80
                      ? 'bg-green-100 text-green-700'
                      : topic.coverage_percentage >= 50
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                  )}
                >
                  {topic.coverage_percentage >= 80
                    ? 'Good'
                    : topic.coverage_percentage >= 50
                    ? 'Fair'
                    : 'Poor'}
                </div>
              </div>

              {/* Coverage Bar */}
              <div className="w-full h-2 bg-yellow-200 rounded-full overflow-hidden">
                <div
                  className={clsx(
                    'h-full rounded-full transition-all',
                    topic.coverage_percentage >= 80
                      ? 'bg-green-500'
                      : topic.coverage_percentage >= 50
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  )}
                  style={{ width: `${topic.coverage_percentage}%` }}
                ></div>
              </div>
            </div>
          ))}

          {sortedTopics.length > 5 && (
            <button className="w-full py-2 px-4 text-sm font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors">
              View All {sortedTopics.length} Topics with Gaps
            </button>
          )}
        </div>
      </div>

      {/* Unanswered Query Patterns */}
      {unansweredQueries.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Search className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Frequent Unanswered Queries
            </h3>
          </div>

          <div className="space-y-2">
            {unansweredQueries.slice(0, 5).map((query, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border border-blue-200 rounded-lg bg-blue-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {query.pattern}
                    </div>
                    <div className="text-xs text-gray-600">
                      Asked {query.frequency} time{query.frequency !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                <span className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded">
                  {query.frequency}x
                </span>
              </div>
            ))}

            {unansweredQueries.length > 5 && (
              <button className="w-full py-2 px-4 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                View All {unansweredQueries.length} Query Patterns
              </button>
            )}
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="border border-green-200 rounded-lg p-4 bg-green-50">
        <div className="flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-green-900 mb-2">
              Recommended Actions
            </h4>
            <ul className="space-y-2 text-sm text-green-800">
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">•</span>
                <span>
                  Focus on the top {Math.min(3, sortedTopics.length)} topics with lowest
                  coverage
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">•</span>
                <span>
                  Add documentation addressing the {unansweredQueries.length} most frequent
                  unanswered queries
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">•</span>
                <span>
                  Review existing documents to ensure they cover related subtopics
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {sortedTopics.length === 0 && unansweredQueries.length === 0 && (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
            <HelpCircle className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Knowledge Gaps Detected
          </h3>
          <p className="text-sm text-gray-600">
            Your knowledge base appears to have comprehensive coverage.
          </p>
        </div>
      )}
    </div>
  );
}
