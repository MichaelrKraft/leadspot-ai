# Wire Frontend to Live Backend API

## Tasks
- [x] Create `lib/api/dashboard.ts` - typed fetch wrappers for `/api/insights/*`
- [x] Create `lib/api/chat.ts` - typed axios wrapper for `/api/chat` using `apiClient`
- [x] Export `apiClient` from `lib/api.ts` so chat service can use it
- [x] Update dashboard page - use `fetchDailyInsights()`, demo data as defaults, "Demo Mode" badge
- [x] Update command center page - use `sendChatMessage()`, fix stale closure, better error messages

## Review
- `lib/api.ts`: Added `export { apiClient }` so the chat service can access the axios instance with auth/CSRF interceptors
- `lib/api/dashboard.ts`: Three public functions using native `fetch` (no auth needed). Includes 10s abort timeout on daily insights.
- `lib/api/chat.ts`: Uses `apiClient` (axios) for auth headers + CSRF. Maps backend response shape to typed `ChatResponse`.
- `dashboard/page.tsx`: Initial state now holds demo data (no more `showDemoData()` helper). API response replaces it if available. `demoMode` badge shown when `mautic_connected` is false or API fails.
- `command-center/page.tsx`: Captures `input` before clearing (`const currentInput = input`) to fix stale closure. Tool results mapped from `{ success, display }` to `{ status, summary }`. Error messages distinguish 401 (auth) from network errors.
