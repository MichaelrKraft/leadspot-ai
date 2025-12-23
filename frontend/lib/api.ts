import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from "axios";

// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_TIMEOUT = 30000; // 30 seconds

// Custom error types
export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "APIError";
  }
}

/**
 * Get CSRF token from cookie for state-changing requests.
 */
function getCSRFToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

// Create axios instance with default config
const createAPIClient = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: API_TIMEOUT,
    headers: {
      "Content-Type": "application/json",
    },
    withCredentials: true, // Required for httpOnly cookies
  });

  // Request interceptor - add CSRF token for state-changing requests
  instance.interceptors.request.use(
    (config) => {
      // Add CSRF token for non-GET requests (required for cookie-based auth)
      if (config.method && ["post", "put", "patch", "delete"].includes(config.method.toLowerCase())) {
        const csrfToken = getCSRFToken();
        if (csrfToken) {
          config.headers["X-CSRF-Token"] = csrfToken;
        }
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor - handle errors and token refresh
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

      // Handle 401 - try to refresh token
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        try {
          // Attempt token refresh using cookie
          await instance.post("/auth/refresh");
          // Retry original request
          return instance(originalRequest);
        } catch (refreshError) {
          // Refresh failed - redirect to login
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
          throw refreshError;
        }
      }

      if (error.response) {
        const { status, data } = error.response;
        const errorData = data as { message?: string; code?: string; details?: unknown; detail?: string };

        throw new APIError(
          errorData.message || errorData.detail || "An error occurred",
          status,
          errorData.code,
          errorData.details
        );
      } else if (error.request) {
        throw new APIError("Network error - please check your connection", 0);
      } else {
        throw new APIError("Request failed", 0);
      }
    }
  );

  return instance;
};

// Create singleton instance
const apiClient = createAPIClient();

// API methods
export const api = {
  // Authentication
  auth: {
    login: (email: string, password: string) =>
      apiClient.post("/auth/login", { email, password }),

    register: (data: { email: string; password: string; name: string; organization_domain?: string }) =>
      apiClient.post("/auth/register", {
        ...data,
        organization_domain: data.organization_domain || data.email.split('@')[1],
      }),

    logout: () =>
      apiClient.post("/auth/logout"),

    getCurrentUser: () =>
      apiClient.get("/auth/me"),

    refreshToken: () =>
      apiClient.post("/auth/refresh"),
  },

  // Search
  search: {
    query: (query: string, options?: { filters?: Record<string, unknown> }) =>
      apiClient.post("/search/query", { query, ...options }),

    suggestions: (partial: string) =>
      apiClient.get("/search/suggestions", { params: { q: partial } }),

    history: (limit = 20) =>
      apiClient.get("/search/history", { params: { limit } }),
  },

  // Knowledge Base
  knowledge: {
    getSources: () =>
      apiClient.get("/knowledge/sources"),

    getDocuments: (params?: { page?: number; limit?: number; source?: string }) =>
      apiClient.get("/knowledge/documents", { params }),

    getDocument: (id: string) =>
      apiClient.get(`/knowledge/documents/${id}`),

    indexDocument: (data: { title: string; content: string; source: string; metadata?: Record<string, unknown> }) =>
      apiClient.post("/knowledge/index", data),
  },

  // Analytics
  analytics: {
    getUsageStats: (params?: { start_date?: string; end_date?: string }) =>
      apiClient.get("/analytics/usage", { params }),

    getPopularQueries: (limit = 10) =>
      apiClient.get("/analytics/popular-queries", { params: { limit } }),

    getSourceDistribution: () =>
      apiClient.get("/analytics/source-distribution"),
  },

  // Integrations
  integrations: {
    list: () =>
      apiClient.get("/integrations"),

    connect: (provider: string, credentials: Record<string, unknown>) =>
      apiClient.post(`/integrations/${provider}/connect`, credentials),

    disconnect: (provider: string) =>
      apiClient.delete(`/integrations/${provider}/disconnect`),

    sync: (provider: string) =>
      apiClient.post(`/integrations/${provider}/sync`),
  },

  // Bookmarks
  bookmarks: {
    list: () =>
      apiClient.get("/bookmarks"),

    create: (data: { query: string; answer: string; citations: unknown[] }) =>
      apiClient.post("/bookmarks", data),

    delete: (id: string) =>
      apiClient.delete(`/bookmarks/${id}`),
  },

  // Feedback
  feedback: {
    submit: (data: { query: string; answer_id: string; rating: "up" | "down"; comment?: string }) =>
      apiClient.post("/feedback", data),
  },

  // Decisions - Decision Archaeology
  decisions: {
    // List all decisions with pagination
    list: (params?: { page?: number; page_size?: number; category?: string; status?: string }) =>
      apiClient.get("/api/decisions/", { params }),

    // Get single decision by ID
    get: (id: string) =>
      apiClient.get(`/api/decisions/${id}`),

    // Create new decision
    create: (data: { title: string; description: string; category?: string; decision_date?: string; context?: Record<string, unknown> }) =>
      apiClient.post("/api/decisions/", data),

    // Update decision
    update: (id: string, data: { title?: string; description?: string; category?: string; status?: string; decision_date?: string; context?: Record<string, unknown> }) =>
      apiClient.put(`/api/decisions/${id}`, data),

    // Delete decision
    delete: (id: string) =>
      apiClient.delete(`/api/decisions/${id}`),

    // Get decision timeline
    getTimeline: (id: string, includeRelated: boolean = true) =>
      apiClient.get(`/api/decisions/${id}/timeline`, { params: { include_related: includeRelated } }),

    // Get related decisions
    getRelated: (id: string, maxDepth: number = 2) =>
      apiClient.get(`/api/decisions/${id}/related`, { params: { max_depth: maxDepth } }),

    // Get decision factors
    getFactors: (id: string) =>
      apiClient.get(`/api/decisions/${id}/factors`),

    // Predict outcomes
    predictOutcomes: (id: string) =>
      apiClient.post(`/api/decisions/${id}/predict-outcomes`),

    // Natural language query
    query: (data: { query: string; include_timeline?: boolean; include_factors?: boolean; max_results?: number }) =>
      apiClient.post("/api/decisions/query", data),

    // Get graph stats
    getGraphStats: () =>
      apiClient.get("/api/decisions/stats/graph"),

    // Analyze patterns (Phase 6)
    analyzePatterns: (data?: { start_date?: string; end_date?: string }) =>
      apiClient.post("/api/decisions/analyze-patterns", data),

    // Get AI insights for a decision (Phase 6)
    getInsights: (id: string) =>
      apiClient.get(`/api/decisions/${id}/insights`),
  },
};

// Helper function for handling file uploads
export const uploadFile = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<unknown> => {
  const formData = new FormData();
  formData.append("file", file);

  const config: AxiosRequestConfig = {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(progress);
      }
    },
  };

  const response = await apiClient.post("/knowledge/upload", formData, config);
  return response.data;
};

export default api;
