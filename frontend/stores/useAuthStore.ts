import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Backend API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface User {
  id: string;
  email: string;
  name: string;
  organization?: string;
  organizationId?: string;
  role?: string;
  avatar?: string;
}

interface AuthState {
  // State
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    name: string;
    organizationDomain?: string;
  }) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Initial state
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Set user
      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
        }),

      // Set token (kept for compatibility, but tokens are now in httpOnly cookies)
      setToken: (token) => {
        set({ token });
      },

      // Login - Real API call to backend
      login: async (email, password) => {
        set({ isLoading: true, error: null });

        try {
          const response = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include", // Required for httpOnly cookies
            body: JSON.stringify({ email, password }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || "Login failed");
          }

          const data = await response.json();

          // Map backend response to frontend format
          const user: User = {
            id: data.user.user_id,
            email: data.user.email,
            name: data.user.name,
            organizationId: data.user.organization_id,
            role: data.user.role,
          };

          const token = data.access_token;

          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
          // Token is now stored in httpOnly cookie by the backend
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Login failed";
          set({
            error: errorMessage,
            isLoading: false,
          });
          throw new Error(errorMessage);
        }
      },

      // Register - Real API call to backend
      register: async (data) => {
        set({ isLoading: true, error: null });

        try {
          // Extract domain from email if organizationDomain not provided
          const organizationDomain =
            data.organizationDomain || data.email.split("@")[1];

          const response = await fetch(`${API_URL}/auth/register`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include", // Required for httpOnly cookies
            body: JSON.stringify({
              email: data.email,
              name: data.name,
              password: data.password,
              organization_domain: organizationDomain,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || "Registration failed");
          }

          const responseData = await response.json();

          // Map backend response to frontend format
          const user: User = {
            id: responseData.user.user_id,
            email: responseData.user.email,
            name: responseData.user.name,
            organizationId: responseData.user.organization_id,
            role: responseData.user.role,
          };

          const token = responseData.access_token;

          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
          // Token is now stored in httpOnly cookie by the backend
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Registration failed";
          set({
            error: errorMessage,
            isLoading: false,
          });
          throw new Error(errorMessage);
        }
      },

      // Logout - call backend to clear httpOnly cookies
      logout: async () => {
        try {
          await fetch(`${API_URL}/auth/logout`, {
            method: "POST",
            credentials: "include",
          });
        } catch (error) {
          console.error("Logout error:", error);
        }
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        });
      },

      // Clear error
      clearError: () => set({ error: null }),
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          console.log('[useAuthStore] Hydration complete, token present:', !!state?.token);
        };
      },
    }
  )
);

// Helper to wait for hydration using Zustand's built-in API
export const waitForHydration = (): Promise<void> => {
  return new Promise((resolve) => {
    // Check if already hydrated
    if (useAuthStore.persist.hasHydrated()) {
      resolve();
      return;
    }
    // Otherwise wait for hydration to complete
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
  });
};

// Helper to check if hydrated
export const isHydrated = () => useAuthStore.persist.hasHydrated();
