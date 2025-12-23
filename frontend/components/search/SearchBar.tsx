"use client";

import { useState, FormEvent, KeyboardEvent } from "react";
import { Search, Sparkles } from "lucide-react";
import Button from "@/components/ui/Button";
import clsx from "clsx";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

export default function SearchBar({
  onSearch,
  isLoading = false,
  placeholder = "Search your organization's knowledge...",
  className,
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (query.trim() && !isLoading) {
      onSearch(query.trim());
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (query.trim() && !isLoading) {
        onSearch(query.trim());
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={clsx(
        "relative w-full transition-all duration-300",
        isFocused && "scale-[1.02]",
        className
      )}
    >
      {/* Glow effect on focus */}
      {isFocused && (
        <div className="absolute -inset-1 bg-gradient-to-r from-primary-600 to-primary-400 rounded-2xl opacity-20 blur-xl animate-pulse" />
      )}

      <div
        className={clsx(
          "relative glass rounded-2xl border transition-all duration-300",
          isFocused
            ? "border-blue-500 dark:border-primary-500 shadow-lg dark:shadow-glow-lg"
            : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
        )}
      >
        <div className="flex items-start gap-4 p-4">
          {/* Search icon */}
          <div className="flex-shrink-0 mt-2">
            {isLoading ? (
              <div className="w-6 h-6 spinner" />
            ) : (
              <Search
                className={clsx(
                  "w-6 h-6 transition-colors",
                  isFocused ? "text-blue-500 dark:text-primary-400" : "text-gray-400"
                )}
              />
            )}
          </div>

          {/* Input area */}
          <div className="flex-1 min-w-0">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isLoading}
              rows={1}
              className="w-full bg-transparent border-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none text-lg disabled:opacity-50 scrollbar-thin"
              style={{
                minHeight: "32px",
                maxHeight: "200px",
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = target.scrollHeight + "px";
              }}
            />

            {/* Helper text */}
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-500">
                <kbd className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400">
                  Enter
                </kbd>{" "}
                to search •{" "}
                <kbd className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400">
                  Shift + Enter
                </kbd>{" "}
                for new line
              </p>

              {query.length > 0 && (
                <p className="text-xs text-gray-500">
                  {query.length} characters
                </p>
              )}
            </div>
          </div>

          {/* Submit button */}
          <div className="flex-shrink-0">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!query.trim() || isLoading}
              isLoading={isLoading}
              className="min-w-[120px]"
            >
              {!isLoading && <Sparkles className="w-4 h-4 mr-2" />}
              Synthesize
            </Button>
          </div>
        </div>

        {/* AI indicator */}
        <div className="px-4 pb-3 flex items-center gap-2 text-xs text-gray-500">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          AI-powered semantic search across 50+ enterprise sources
        </div>
      </div>

      {/* Suggested queries (optional) */}
      {!query && !isLoading && (
        <div className="mt-4 flex flex-wrap gap-2 justify-center">
          {[
            "What are our Q1 OKRs?",
            "Latest product updates",
            "Security compliance status",
          ].map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setQuery(suggestion)}
              className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-300 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-blue-400 dark:hover:border-primary-600 hover:bg-blue-50 dark:hover:bg-primary-900/20 transition-all duration-200"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
