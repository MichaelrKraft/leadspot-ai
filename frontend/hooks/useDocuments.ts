/**
 * useDocuments Hook
 * Handles document fetching, uploading, and management via real API
 *
 * Uses httpOnly cookie-based authentication (credentials: 'include')
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Document, DocumentListItem, DocumentFilters } from '@/types/document';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Transform backend document to frontend format
function transformDocument(doc: any): DocumentListItem {
  return {
    document_id: doc.id || doc.document_id,
    title: doc.title,
    author: doc.author || undefined,
    created_at: doc.created_at,
    source_system: doc.source_system || 'upload',
    metadata: {
      file_type: doc.mime_type?.split('/')[1]?.toUpperCase() || doc.filename?.split('.').pop()?.toUpperCase(),
      page_count: doc.page_count || undefined,
    },
    tags: doc.tags || [],
  };
}

function transformFullDocument(doc: any, content?: string): Document {
  return {
    document_id: doc.id || doc.document_id,
    title: doc.title,
    content: content || '',
    author: doc.author || undefined,
    created_at: doc.created_at,
    updated_at: doc.last_modified || doc.created_at,
    source_system: doc.source_system || 'upload',
    url: doc.url || undefined,
    metadata: {
      file_type: doc.mime_type?.split('/')[1]?.toUpperCase() || doc.filename?.split('.').pop()?.toUpperCase(),
      file_size: doc.file_size,
      page_count: doc.page_count || undefined,
      language: 'en',
      summary: doc.description || undefined,
      last_indexed: doc.indexed_at || undefined,
    },
    tags: doc.tags || [],
  };
}

export function useDocuments(filters?: DocumentFilters) {
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/documents`, {
        credentials: 'include', // Send httpOnly cookies
      });

      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }

      const data = await response.json();
      let docs = (data.documents || []).map(transformDocument);

      // Apply client-side filters
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        docs = docs.filter((doc: DocumentListItem) =>
          doc.title.toLowerCase().includes(searchLower) ||
          doc.author?.toLowerCase().includes(searchLower)
        );
      }

      if (filters?.source_systems && filters.source_systems.length > 0) {
        docs = docs.filter((doc: DocumentListItem) =>
          filters.source_systems!.includes(doc.source_system)
        );
      }

      if (filters?.file_types && filters.file_types.length > 0) {
        docs = docs.filter((doc: DocumentListItem) =>
          filters.file_types!.includes(doc.metadata.file_type || '')
        );
      }

      if (filters?.tags && filters.tags.length > 0) {
        docs = docs.filter((doc: DocumentListItem) =>
          doc.tags?.some(tag => filters.tags!.includes(tag))
        );
      }

      setDocuments(docs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch documents');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return { documents, isLoading, error, refetch: fetchDocuments };
}

export function useDocument(documentId: string) {
  const [document, setDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocument = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch document metadata
        const docResponse = await fetch(`${API_URL}/api/documents/${documentId}`, {
          credentials: 'include', // Send httpOnly cookies
        });

        if (!docResponse.ok) {
          if (docResponse.status === 404) {
            setError('Document not found');
          } else {
            throw new Error('Failed to fetch document');
          }
          return;
        }

        const docData = await docResponse.json();

        // Fetch document content
        const contentResponse = await fetch(`${API_URL}/api/documents/${documentId}/content`, {
          credentials: 'include', // Send httpOnly cookies
        });

        let content = '';
        if (contentResponse.ok) {
          const contentData = await contentResponse.json();
          content = contentData.content || '';
        }

        setDocument(transformFullDocument(docData, content));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch document');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocument();
  }, [documentId]);

  return { document, isLoading, error };
}

export function useDocumentUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadDocument = async (file: File, title?: string): Promise<string | null> => {
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (title) {
        formData.append('title', title);
      }

      setUploadProgress(30);

      const response = await fetch(`${API_URL}/api/documents/upload`, {
        method: 'POST',
        credentials: 'include', // Send httpOnly cookies
        body: formData,
      });

      setUploadProgress(80);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Upload failed');
      }

      const data = await response.json();
      setUploadProgress(100);

      return data.document?.id || data.document?.document_id || null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadDocument, isUploading, uploadProgress, error };
}

export function useDocumentStats() {
  const [stats, setStats] = useState<{
    total_documents: number;
    total_size_bytes: number;
    status_counts: Record<string, number>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_URL}/api/documents/stats`, {
          credentials: 'include', // Send httpOnly cookies
        });

        if (!response.ok) {
          throw new Error('Failed to fetch stats');
        }

        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch stats');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, isLoading, error };
}

export function useDeleteDocument() {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteDocument = async (documentId: string): Promise<boolean> => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/documents/${documentId}`, {
        method: 'DELETE',
        credentials: 'include', // Send httpOnly cookies
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Delete failed');
      }

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  return { deleteDocument, isDeleting, error };
}
