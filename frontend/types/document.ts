/**
 * Document Types for InnoSynth.ai
 * Handles document structures and metadata
 */

export interface Document {
  document_id: string;
  title: string;
  content: string;
  author?: string;
  created_at: string;
  updated_at: string;
  source_system: string;
  url?: string;
  metadata: DocumentMetadata;
  tags?: string[];
}

export interface DocumentMetadata {
  file_type?: string;
  file_size?: number;
  page_count?: number;
  language?: string;
  summary?: string;
  embedding_model?: string;
  last_indexed?: string;
}

export interface DocumentListItem {
  document_id: string;
  title: string;
  author?: string;
  created_at: string;
  source_system: string;
  metadata: {
    file_type?: string;
    page_count?: number;
  };
  tags?: string[];
}

export interface DocumentUploadRequest {
  file: File;
  metadata?: {
    title?: string;
    author?: string;
    tags?: string[];
  };
}

export interface DocumentUploadResponse {
  document_id: string;
  status: 'processing' | 'completed' | 'failed';
  message?: string;
}

export interface DocumentFilters {
  search?: string;
  source_systems?: string[];
  file_types?: string[];
  date_range?: {
    start: string;
    end: string;
  };
  tags?: string[];
}
