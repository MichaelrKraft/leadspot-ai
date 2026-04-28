/**
 * Privacy + Ghostlog daemon-management API client.
 *
 * Wraps the backend endpoints surfaced in the Privacy settings page:
 *   - GET/DELETE /api/daemon/auth/devices         (list/revoke daemons)
 *   - POST       /api/daemon/auth/pause           (set/clear pause)
 *   - GET/PUT    /api/settings/privacy/eu-strict-mode
 *   - POST       /api/contacts/forget             (user-facing RTBF)
 *   - POST       /admin/purge                     (admin-only RTBF)
 *   - GET        /api/admin/cost-dashboard        (admin cost dashboard)
 */

import { apiClient } from '@/lib/api';

// =============================================================================
// Types
// =============================================================================

export interface DaemonDevice {
  daemon_id: string;
  device_label: string;
  last_seen_at: string | null;
  created_at: string;
}

export type PauseDuration = '1h' | 'today' | 'forever' | 'resume';

export interface PauseResponse {
  affected: number;
  paused_until: string | null;
}

export interface EuStrictModeStatus {
  eu_strict_mode: boolean;
}

export interface ForgetResponse {
  purged_count: number;
  tombstone_id: string;
  email_hash: string;
}

export interface AdminPurgeResponse {
  purged_count: number;
  tombstone_id: string;
}

export interface CostDashboardUserRow {
  user_id: string;
  email: string;
  haiku_tokens_today: number;
  haiku_tokens_30d: number;
  sonnet_tokens_30d: number;
  estimated_cost_30d_usd: number;
  cap_hits_30d: number;
  daemon_count: number;
}

export interface CostDashboardTotals {
  user_count: number;
  haiku_tokens_30d: number;
  sonnet_tokens_30d: number;
  estimated_cost_30d_usd: number;
  cap: number;
}

export interface CostDashboardResponse {
  users: CostDashboardUserRow[];
  totals: CostDashboardTotals;
  days: number;
}

// =============================================================================
// Devices
// =============================================================================

export async function listDevices(): Promise<DaemonDevice[]> {
  const res = await apiClient.get<{ devices: DaemonDevice[] }>(
    '/api/daemon/auth/devices'
  );
  return res.data.devices;
}

export async function revokeDevice(daemonId: string): Promise<void> {
  await apiClient.delete(`/api/daemon/auth/devices/${daemonId}`);
}

// =============================================================================
// Pause
// =============================================================================

export async function setPause(
  duration: PauseDuration,
  daemonId?: string
): Promise<PauseResponse> {
  const body: { duration: PauseDuration; daemon_id?: string } = { duration };
  if (daemonId) body.daemon_id = daemonId;
  const res = await apiClient.post<PauseResponse>('/api/daemon/auth/pause', body);
  return res.data;
}

// =============================================================================
// EU strict mode
// =============================================================================

export async function getEuStrictMode(): Promise<EuStrictModeStatus> {
  const res = await apiClient.get<EuStrictModeStatus>(
    '/api/settings/privacy/eu-strict-mode'
  );
  return res.data;
}

export async function setEuStrictMode(value: boolean): Promise<EuStrictModeStatus> {
  const res = await apiClient.put<EuStrictModeStatus>(
    '/api/settings/privacy/eu-strict-mode',
    { eu_strict_mode: value }
  );
  return res.data;
}

// =============================================================================
// Right to be forgotten
// =============================================================================

export async function forgetContact(
  email: string,
  reason?: string
): Promise<ForgetResponse> {
  const res = await apiClient.post<ForgetResponse>('/api/contacts/forget', {
    email,
    reason,
  });
  return res.data;
}

export async function adminPurgeByHash(
  emailHash: string,
  reason?: string
): Promise<AdminPurgeResponse> {
  // Note: /admin/* is not proxied through Next rewrites, so the request
  // hits the same origin as the dashboard. In dev the backend dev-proxy
  // handles it; in prod the deploy must route /admin/* to the backend.
  const res = await apiClient.post<AdminPurgeResponse>('/admin/purge', {
    email_hash: emailHash,
    reason,
  });
  return res.data;
}

// =============================================================================
// Cost dashboard (admin)
// =============================================================================

export async function getCostDashboard(
  days: number = 30
): Promise<CostDashboardResponse> {
  const res = await apiClient.get<CostDashboardResponse>(
    '/api/admin/cost-dashboard',
    { params: { days } }
  );
  return res.data;
}
