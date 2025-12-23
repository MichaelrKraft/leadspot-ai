/**
 * Query Types for InnoSynth.ai
 * Handles search queries, filters, and response structures
 */

export interface QueryRequest {
  query: string;
  filters?: QueryFilters;
  research_mode?: boolean;
}

export interface QueryFilters {
  sources?: string[];
  dateRange?: { start: string; end: string };
  authors?: string[];
  documentTypes?: string[];
}

export interface Source {
  document_id: string;
  title: string;
  url: string;
  excerpt: string;
  author?: string;
  source_system: string;
  relevance_score?: number;
  page_number?: number;
  source_url?: string;  // URL to open document in source system
  mime_type?: string;   // File type (application/pdf, etc.)
}

export interface QueryResponse {
  query_id: string;
  answer: string;
  sources: Source[];
  response_time_ms: number;
  confidence?: number;
  metadata?: {
    model_used?: string;
    tokens_used?: number;
  };
  follow_up_questions?: string[];
  research_mode?: boolean;
  sub_queries?: string[];
}

export interface QueryHistoryItem {
  query_id: string;
  query_text: string;
  created_at: string;
  sources_cited: number;
  confidence?: number;
}

export interface QuerySuggestion {
  text: string;
  category: string;
}
