"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import SearchBar from "@/components/search/SearchBar";
import SearchResults from "@/components/search/SearchResults";
import { Search, Zap, Shield, TrendingUp } from "lucide-react";

interface SearchResult {
  answer: string;
  citations: Array<{
    id: string;
    title: string;
    source: string;
    snippet: string;
    url?: string;
  }>;
  confidence: number;
}

export default function HomePage() {
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (query: string) => {
    setIsSearching(true);

    try {
      // TODO: Replace with actual API call
      // Simulated search for demo
      await new Promise(resolve => setTimeout(resolve, 1500));

      setSearchResults({
        answer: "Based on your organization's knowledge base, here's a synthesized answer...",
        citations: [
          {
            id: "1",
            title: "Product Requirements Document Q4 2024",
            source: "Confluence",
            snippet: "This document outlines the key requirements for...",
            url: "#"
          },
          {
            id: "2",
            title: "Engineering Meeting Notes - Jan 2025",
            source: "Notion",
            snippet: "Team discussed implementation details regarding...",
            url: "#"
          },
        ],
        confidence: 0.89
      });
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-background">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative pt-20 pb-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
          {/* Animated background */}
          <div className="absolute inset-0 animated-gradient opacity-50" />

          {/* Grid pattern overlay */}
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />

          <div className="relative max-w-7xl mx-auto">
            <div className="text-center animate-fade-in">
              {/* Hero heading */}
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight text-gray-900 dark:text-white">
                From <span className="text-blue-600 dark:text-blue-400">Search</span> to{" "}
                <span className="text-blue-600 dark:text-blue-400">Synthesis</span>
              </h1>

              {/* Tagline */}
              <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto text-balance">
                Transform your organization's knowledge chaos into competitive advantage
              </p>

              {/* Search Bar - Prominent and Centered */}
              <div className="max-w-3xl mx-auto mb-16 animate-slide-up">
                <SearchBar
                  onSearch={handleSearch}
                  isLoading={isSearching}
                  placeholder="Ask anything about your organization's knowledge..."
                />
              </div>

              {/* Search Results */}
              {searchResults && (
                <div className="max-w-4xl mx-auto animate-fade-in">
                  <SearchResults results={searchResults} />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Features Section */}
        {!searchResults && (
          <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-background-secondary">
            <div className="max-w-7xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-gray-900 dark:text-white">
                Enterprise-Grade Knowledge Synthesis
              </h2>

              <div className="grid md:grid-cols-3 gap-8">
                {/* Feature 1 */}
                <div className="glass rounded-xl p-8 card-hover">
                  <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-primary-900/50 flex items-center justify-center mb-4">
                    <Search className="w-6 h-6 text-blue-600 dark:text-primary-400" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">Intelligent Search</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    AI-powered semantic search across all your enterprise knowledge sources
                  </p>
                </div>

                {/* Feature 2 */}
                <div className="glass rounded-xl p-8 card-hover delay-100">
                  <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-primary-900/50 flex items-center justify-center mb-4">
                    <Zap className="w-6 h-6 text-blue-600 dark:text-primary-400" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">Instant Synthesis</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Get synthesized answers with verifiable citations in seconds
                  </p>
                </div>

                {/* Feature 3 */}
                <div className="glass rounded-xl p-8 card-hover delay-200">
                  <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-primary-900/50 flex items-center justify-center mb-4">
                    <Shield className="w-6 h-6 text-blue-600 dark:text-primary-400" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">Enterprise Security</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    SOC 2 compliant with role-based access control and data encryption
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Stats Section */}
        {!searchResults && (
          <section className="py-20 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
              <div className="grid md:grid-cols-3 gap-8 text-center">
                <div className="animate-fade-in">
                  <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">10x</div>
                  <p className="text-gray-600 dark:text-gray-400">Faster Knowledge Retrieval</p>
                </div>
                <div className="animate-fade-in delay-100">
                  <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">95%</div>
                  <p className="text-gray-600 dark:text-gray-400">Answer Accuracy</p>
                </div>
                <div className="animate-fade-in delay-200">
                  <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">50+</div>
                  <p className="text-gray-600 dark:text-gray-400">Data Source Integrations</p>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-transparent">
        <div className="max-w-7xl mx-auto text-center text-gray-500 dark:text-gray-400 text-sm">
          © 2025 InnoSynth.ai. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
