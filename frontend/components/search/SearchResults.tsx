"use client";

import { useState } from "react";
import Card, {
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  Share2,
} from "lucide-react";
import clsx from "clsx";

interface Citation {
  id: string;
  title: string;
  source: string;
  snippet: string;
  url?: string;
}

interface SearchResultsProps {
  results: {
    answer: string;
    citations: Citation[];
    confidence: number;
  };
}

export default function SearchResults({ results }: SearchResultsProps) {
  const [copiedAnswer, setCopiedAnswer] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const handleCopyAnswer = () => {
    navigator.clipboard.writeText(results.answer);
    setCopiedAnswer(true);
    setTimeout(() => setCopiedAnswer(false), 2000);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-success";
    if (confidence >= 0.6) return "text-warning";
    return "text-error";
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return "High Confidence";
    if (confidence >= 0.6) return "Medium Confidence";
    return "Low Confidence";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Main Answer Card */}
      <Card variant="glass" padding="lg">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-success" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Synthesized Answer
                </span>
              </div>
              <CardTitle className="text-2xl">Knowledge Synthesis</CardTitle>
            </div>

            {/* Confidence indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-background-tertiary border border-gray-300 dark:border-gray-700">
              <AlertCircle
                className={clsx("w-4 h-4", getConfidenceColor(results.confidence))}
              />
              <span className={clsx("text-sm font-medium", getConfidenceColor(results.confidence))}>
                {getConfidenceLabel(results.confidence)}
              </span>
              <span className="text-xs text-gray-500 ml-1">
                ({Math.round(results.confidence * 100)}%)
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Answer text */}
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-lg leading-relaxed text-gray-700 dark:text-gray-200">
              {results.answer}
            </p>
          </div>

          {/* Citations inline */}
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Sources:</span>
            {results.citations.map((citation, index) => (
              <button
                key={citation.id}
                onClick={() => setSelectedCitation(
                  selectedCitation === citation.id ? null : citation.id
                )}
                className={clsx(
                  "citation-badge",
                  selectedCitation === citation.id && "ring-2 ring-primary-500"
                )}
              >
                [{index + 1}] {citation.source}
              </button>
            ))}
          </div>
        </CardContent>

        <CardFooter>
          <div className="flex items-center justify-between w-full">
            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyAnswer}
              >
                <Copy className="w-4 h-4 mr-2" />
                {copiedAnswer ? "Copied!" : "Copy"}
              </Button>

              <Button variant="ghost" size="sm">
                <Bookmark className="w-4 h-4 mr-2" />
                Save
              </Button>

              <Button variant="ghost" size="sm">
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>

            {/* Feedback buttons */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 mr-2">Was this helpful?</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFeedback(feedback === "up" ? null : "up")}
                className={clsx(
                  feedback === "up" && "text-success border-success"
                )}
              >
                <ThumbsUp className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFeedback(feedback === "down" ? null : "down")}
                className={clsx(
                  feedback === "down" && "text-error border-error"
                )}
              >
                <ThumbsDown className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardFooter>
      </Card>

      {/* Detailed Citations */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Detailed Citations ({results.citations.length})
        </h3>

        {results.citations.map((citation, index) => (
          <Card
            key={citation.id}
            variant="bordered"
            padding="md"
            hover
            className={clsx(
              "transition-all duration-300",
              selectedCitation === citation.id && "ring-2 ring-primary-500 border-primary-600"
            )}
          >
            <div className="flex items-start gap-4">
              {/* Citation number */}
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-primary-900/30 border border-blue-200 dark:border-primary-700/50 flex items-center justify-center text-blue-600 dark:text-primary-400 font-semibold">
                {index + 1}
              </div>

              {/* Citation content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                      {citation.title}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Source: <span className="text-blue-600 dark:text-primary-400">{citation.source}</span>
                    </p>
                  </div>

                  {citation.url && (
                    <a
                      href={citation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors group"
                    >
                      <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-primary-400" />
                    </a>
                  )}
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  {citation.snippet}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Additional insights */}
      <Card variant="glass" padding="md">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
              AI Synthesis Notice
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This answer was synthesized from {results.citations.length} sources in your
              organization's knowledge base. Always verify critical information with source
              documents.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
