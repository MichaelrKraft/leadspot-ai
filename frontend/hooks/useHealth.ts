// Health Data Hook
// Updated to use real knowledge-health API with httpOnly cookie auth

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  HealthDashboard,
  HealthAlert,
  HealthFilter,
  AlertStatus
} from '@/types/health';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Demo data for when API is unavailable (bond trading focused)
const DEMO_HEALTH_DASHBOARD: HealthDashboard = {
  health_score: 78,
  score_trend: 3,
  stats: {
    total_documents: 1247,
    active_alerts: 12,
    knowledge_gaps: 4,
    documents_at_risk: 8,
    last_scan: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    scan_in_progress: false,
  },
  recent_alerts: [
    {
      id: 'alert-1',
      type: 'conflict',
      severity: 'critical',
      status: 'active',
      title: 'Conflicting municipal bond pricing methodology',
      description: 'Document "Q4 Pricing Guidelines" conflicts with "MSRB Best Execution Policy" on spread calculation methods.',
      created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      affected_documents: ['doc-pricing-guidelines', 'doc-msrb-policy'],
    },
    {
      id: 'alert-2',
      type: 'outdated',
      severity: 'warning',
      status: 'active',
      title: 'FINRA Rule 4210 margin requirements outdated',
      description: 'Compliance documentation references 2023 margin requirements. Updated 2024 rules not reflected.',
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      affected_documents: ['doc-finra-compliance'],
    },
    {
      id: 'alert-3',
      type: 'gap',
      severity: 'warning',
      status: 'active',
      title: 'Missing ESG bond classification criteria',
      description: 'No documentation found for green bond and sustainability-linked bond classification standards.',
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      affected_documents: [],
    },
    {
      id: 'alert-4',
      type: 'quality',
      severity: 'info',
      status: 'active',
      title: 'VaR model documentation lacks examples',
      description: 'Risk management VaR documentation would benefit from worked examples and calculation scenarios.',
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      affected_documents: ['doc-var-methodology'],
    },
    {
      id: 'alert-5',
      type: 'conflict',
      severity: 'warning',
      status: 'active',
      title: 'Client risk tolerance definitions inconsistent',
      description: 'CRM client profiles use different risk tolerance scales than trading desk guidelines.',
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      affected_documents: ['doc-crm-profiles', 'doc-trading-guidelines'],
    },
  ],
  gap_analysis: {
    topics_with_gaps: [
      { topic: 'ESG Bond Classification Standards', gap_count: 3, coverage_percentage: 35 },
      { topic: 'Green Bond Verification Process', gap_count: 2, coverage_percentage: 45 },
      { topic: 'FINRA 2024 Regulatory Updates', gap_count: 2, coverage_percentage: 50 },
      { topic: 'Municipal Bond Tax Implications', gap_count: 1, coverage_percentage: 72 },
      { topic: 'High-Yield Bond Risk Assessment', gap_count: 1, coverage_percentage: 78 },
    ],
    query_patterns: [
      { pattern: 'What are the ESG criteria for green bonds?', frequency: 23, has_answer: false },
      { pattern: 'How do we report TRACE trades for munis?', frequency: 18, has_answer: false },
      { pattern: 'What is the margin requirement for BBB bonds?', frequency: 15, has_answer: true },
      { pattern: 'Client suitability requirements for high-yield?', frequency: 12, has_answer: false },
      { pattern: 'Settlement timeline for corporate bonds?', frequency: 9, has_answer: true },
    ],
  },
};

// Fetch health dashboard data
export function useHealthDashboard() {
  return useQuery({
    queryKey: ['health', 'dashboard'],
    queryFn: async (): Promise<HealthDashboard> => {
      try {
        const response = await fetch(`${API_URL}/api/knowledge-health`, {
          credentials: 'include',
        });
        if (!response.ok) {
          // Return demo data when API fails
          console.log('Health API unavailable, using demo data');
          return DEMO_HEALTH_DASHBOARD;
        }
        const data = await response.json();

        // Transform backend response to frontend HealthDashboard type
        const dashboard: HealthDashboard = {
          health_score: data.health_score?.overall_score || 0,
          score_trend: 0,
          stats: {
            total_documents: data.document_stats?.total_documents || 0,
            active_alerts: data.alert_summary?.active_alerts || 0,
            knowledge_gaps: data.alert_summary?.by_type?.knowledge_gap || 0,
            documents_at_risk: (data.alert_summary?.by_type?.outdated || 0) + (data.alert_summary?.by_type?.conflict || 0),
            last_scan: data.last_updated,
            scan_in_progress: false,
          },
          recent_alerts: (data.critical_alerts || []).map((a: any) => ({
            id: a.id,
            type: a.type === 'knowledge_gap' ? 'gap' : a.type,
            severity: a.severity === 'high' ? 'critical' : a.severity === 'medium' ? 'warning' : 'info',
            status: a.status || 'active',
            title: a.description,
            description: a.description,
            created_at: a.created_at,
            updated_at: a.updated_at || a.created_at,
            affected_documents: a.metadata?.doc1_id ? [a.metadata.doc1_id, a.metadata.doc2_id].filter(Boolean) : [],
          })),
        };

        return dashboard;
      } catch (error) {
        // Return demo data on network error
        console.log('Health API error, using demo data:', error);
        return DEMO_HEALTH_DASHBOARD;
      }
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// Fetch all alerts with optional filters
export function useHealthAlerts(filters?: HealthFilter) {
  return useQuery({
    queryKey: ['health', 'alerts', filters],
    queryFn: async (): Promise<HealthAlert[]> => {
      const params = new URLSearchParams();

      if (filters?.type) {
        filters.type.forEach(t => params.append('alert_type', t));
      }
      if (filters?.severity) {
        filters.severity.forEach(s => params.append('severity', s));
      }
      if (filters?.status) {
        filters.status.forEach(s => params.append('status', s));
      }

      const response = await fetch(
        `${API_URL}/api/knowledge-health/alerts?${params.toString()}`,
        { credentials: 'include' }
      );
      if (!response.ok) {
        throw new Error('Failed to fetch alerts');
      }
      const data = await response.json();

      // Transform backend alerts to frontend format
      return (data.alerts || []).map((a: any) => ({
        id: a.id,
        type: a.type,
        severity: a.severity,
        title: a.description,
        description: a.description,
        status: a.status,
        affectedDocuments: a.metadata?.doc1_id ? [a.metadata.doc1_id, a.metadata.doc2_id].filter(Boolean) : [],
        createdAt: a.created_at,
        resolvedAt: a.resolved_at,
      }));
    },
  });
}

// Fetch single alert by ID
export function useHealthAlert(id: string) {
  return useQuery({
    queryKey: ['health', 'alert', id],
    queryFn: async (): Promise<HealthAlert> => {
      const { data } = await axios.get(`${API_URL}/api/health/alerts/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// Update alert status
export function useUpdateAlertStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      alertId,
      status
    }: {
      alertId: string;
      status: AlertStatus;
    }) => {
      const { data } = await axios.patch(
        `${API_URL}/api/health/alerts/${alertId}/status`,
        { status }
      );
      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['health', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['health', 'alerts'] });
      queryClient.invalidateQueries({
        queryKey: ['health', 'alert', variables.alertId]
      });
    },
  });
}

// Trigger health scan
export function useTriggerScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_URL}/api/knowledge-health/scan`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to trigger scan');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate dashboard to show scan status
      queryClient.invalidateQueries({ queryKey: ['health', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['health', 'alerts'] });
    },
  });
}

// Bulk update alerts
export function useBulkUpdateAlerts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      alertIds,
      status
    }: {
      alertIds: string[];
      status: AlertStatus;
    }) => {
      const { data } = await axios.post(
        `${API_URL}/api/health/alerts/bulk-update`,
        { alert_ids: alertIds, status }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health'] });
    },
  });
}
