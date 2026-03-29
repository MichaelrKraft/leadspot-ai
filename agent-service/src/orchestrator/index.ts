/**
 * CRM Agent Orchestrator
 *
 * Central brain that ties together the task router, cron service, memory layer,
 * and LeadSpot API to power AI-driven CRM suggestions, pipeline briefs,
 * and automated follow-ups.
 *
 * Singleton per process -- use createOrchestrator() to get/create the instance.
 */

import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import type {
  AgentServiceConfig,
  AgentSuggestion,
  PipelineBrief,
  CRMAction,
  Contact,
  Deal,
} from '../types';
import { insertSuggestion, getSuggestions, updateSuggestionStatus, insertBrief } from '../db';
import { createCronService } from '../cron';
import type { CronServiceConfig } from '../cron';
import { buildContactContext, buildBriefContext, formatContextForPrompt } from '../memory/context-builder';
import { processExpiredClaims } from '../lead-routing';
import { evaluateAutoPondRules } from '../lead-ponds';
import { processAutoResumes } from '../action-plans/auto-pause';
import { getDueEnrollments, processNextStep } from '../action-plans';

// ============================================================================
// Internal types for LeadSpot API responses (Phase 1 stubs)
// ============================================================================

interface LeadSpotPipelineData {
  contacts: Contact[];
  deals: Deal[];
  campaigns: { id: string; name: string; status: string; metrics?: Record<string, number> }[];
}

// ============================================================================
// CRM Orchestrator Class
// ============================================================================

/**
 * Orchestrates CRM agent operations: briefs, suggestions, approval queue,
 * and cron-triggered actions.
 */
export class CRMOrchestrator {
  private client: Anthropic | null = null;
  private config: AgentServiceConfig | null = null;
  private initialized = false;

  // Data persisted in SQLite via ../db CRUD functions

  /**
   * Initialize the orchestrator with configuration.
   * Must be called before any other method.
   */
  async initialize(config: AgentServiceConfig): Promise<void> {
    if (this.initialized) {
      console.warn('[CRMOrchestrator] Already initialized, skipping re-init');
      return;
    }

    this.config = config;
    this.client = new Anthropic({ apiKey: config.anthropicApiKey });

    // Initialize CronService with orchestrator as the job handler
    createCronService({
      defaultTimezone: config.defaultTimezone,
      onJobRun: async (job) => {
        if (job.payload.action) {
          await this.handleCronAction(job.payload.action, job.organizationId);
        }
        return `Executed ${job.payload.action || 'custom'} for ${job.organizationId}`;
      },
    });

    this.initialized = true;
    console.log('[CRMOrchestrator] Initialized successfully');
  }

  // ==========================================================================
  // Pipeline Brief Generation
  // ==========================================================================

  /**
   * Generate a pipeline brief for an organization.
   * Fetches CRM data, builds memory context, calls Claude to synthesize,
   * saves to DB, and generates suggested actions.
   */
  async generateBrief(organizationId: string): Promise<PipelineBrief> {
    this.ensureInitialized();

    // Step 1: Fetch pipeline data from LeadSpot API
    const pipelineData = await this.fetchPipelineData(organizationId);

    // Step 2: Build memory context
    const memoryContext = await buildBriefContext(organizationId);

    // Step 3: Call Claude to synthesize a brief
    const briefContent = await this.synthesizeBrief(pipelineData, memoryContext);

    // Step 4: Build the brief object
    const brief: PipelineBrief = {
      id: randomUUID(),
      organizationId,
      generatedAt: new Date().toISOString(),
      summary: briefContent.summary,
      newLeads: briefContent.newLeads,
      followUpsNeeded: briefContent.followUpsNeeded,
      dealsAtRisk: briefContent.dealsAtRisk,
      campaignHighlights: briefContent.campaignHighlights,
      suggestedActions: briefContent.suggestedActions.map((action) => ({
        ...action,
        id: randomUUID(),
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
        organizationId,
      })),
    };

    // Step 5: Save to DB
    insertBrief(organizationId, brief);

    // Also add suggested actions to the approval queue
    for (const suggestion of brief.suggestedActions) {
      this.addSuggestion(organizationId, suggestion);
    }

    console.log(`[CRMOrchestrator] Generated brief ${brief.id} for org ${organizationId}`);
    return brief;
  }

  // ==========================================================================
  // Suggestions
  // ==========================================================================

  /**
   * Get AI suggestions for a specific contact.
   * Loads contact facts from memory, calls Claude for context-aware suggestions,
   * and saves them to the approval queue.
   */
  async getSuggestions(organizationId: string, contactId: string): Promise<AgentSuggestion[]> {
    this.ensureInitialized();

    // Step 1: Load contact facts from memory
    const context = await buildContactContext(organizationId, contactId);
    const contactFacts = formatContextForPrompt(context);

    // Step 2: Fetch contact details from LeadSpot API
    const contact = await this.fetchContact(organizationId, contactId);

    // Step 3: Call Claude to generate suggestions
    const suggestions = await this.generateContactSuggestions(contact, contactFacts);

    // Step 4: Save suggestions to approval queue
    const savedSuggestions: AgentSuggestion[] = suggestions.map((s) => ({
      ...s,
      id: randomUUID(),
      contactId,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      organizationId,
    }));

    for (const suggestion of savedSuggestions) {
      this.addSuggestion(organizationId, suggestion);
    }

    return savedSuggestions;
  }

  /**
   * Get suggestions from the approval queue, optionally filtered by status.
   */
  async getQueue(organizationId: string, status?: string): Promise<AgentSuggestion[]> {
    this.ensureInitialized();
    return getSuggestions(organizationId, { status: status || undefined });
  }

  /**
   * Approve a suggestion and mark it for execution.
   */
  async approveSuggestion(organizationId: string, suggestionId: string): Promise<void> {
    this.ensureInitialized();

    const changes = updateSuggestionStatus(
      organizationId,
      suggestionId,
      'executed',
      new Date().toISOString()
    );

    if (changes === 0) {
      throw new Error(`Suggestion ${suggestionId} not found for org ${organizationId}`);
    }

    console.log(`[CRMOrchestrator] Approved and executed suggestion ${suggestionId}`);
  }

  /**
   * Dismiss a suggestion, removing it from the active queue.
   */
  async dismissSuggestion(organizationId: string, suggestionId: string): Promise<void> {
    this.ensureInitialized();

    const changes = updateSuggestionStatus(organizationId, suggestionId, 'dismissed');

    if (changes === 0) {
      throw new Error(`Suggestion ${suggestionId} not found for org ${organizationId}`);
    }

    console.log(`[CRMOrchestrator] Dismissed suggestion ${suggestionId}`);
  }

  // ==========================================================================
  // Cron Action Handler
  // ==========================================================================

  /**
   * Handle a cron-triggered action. Called by the cron service when a job fires.
   */
  async handleCronAction(action: CRMAction, organizationId: string): Promise<void> {
    this.ensureInitialized();

    console.log(`[CRMOrchestrator] Handling cron action: ${action} for org ${organizationId}`);

    switch (action) {
      case 'pipeline_brief':
        await this.generateBrief(organizationId);
        break;

      case 'follow_up_check':
        // TODO: Scan contacts needing follow-up and generate suggestions
        console.log('[CRMOrchestrator] follow_up_check: scanning for overdue follow-ups');
        break;

      case 'lead_score_decay':
        // TODO: Decay lead scores for contacts with no recent activity
        console.log('[CRMOrchestrator] lead_score_decay: adjusting stale lead scores');
        break;

      case 'stalled_deal_alert':
        // TODO: Find deals that haven't moved stages in X days
        console.log('[CRMOrchestrator] stalled_deal_alert: checking for stuck deals');
        break;

      case 'nurture_drip':
        // TODO: Send next drip email in active nurture sequences
        console.log('[CRMOrchestrator] nurture_drip: processing drip sequences');
        break;

      case 'weekly_report':
        // TODO: Generate and deliver weekly performance report
        console.log('[CRMOrchestrator] weekly_report: generating weekly summary');
        break;

      case 'expired_claim_check': {
        const released = processExpiredClaims(organizationId);
        console.log(`[CRMOrchestrator] expired_claim_check: released ${released.length} expired claims`);
        break;
      }

      case 'auto_pond_check': {
        const added = evaluateAutoPondRules(organizationId);
        console.log(`[CRMOrchestrator] auto_pond_check: auto-ponded ${added} leads`);
        break;
      }

      case 'auto_resume_check': {
        const resumed = processAutoResumes(organizationId);
        console.log(`[CRMOrchestrator] auto_resume_check: resumed ${resumed} paused enrollments`);
        break;
      }

      case 'process_action_plans': {
        const due = getDueEnrollments(organizationId);
        console.log(`[CRMOrchestrator] process_action_plans: ${due.length} enrollments due`);
        for (const enrollment of due) {
          try {
            await processNextStep(organizationId, enrollment.id);
          } catch (err) {
            console.error(`[CRMOrchestrator] Failed to process enrollment ${enrollment.id}:`, err);
          }
        }
        break;
      }

      case 'custom':
        console.log('[CRMOrchestrator] custom action: no default handler');
        break;

      default: {
        const exhaustiveCheck: never = action;
        console.warn(`[CRMOrchestrator] Unknown cron action: ${exhaustiveCheck}`);
      }
    }
  }

  // ==========================================================================
  // Private: LeadSpot API Integration (Phase 1 stubs)
  // ==========================================================================

  /**
   * Fetch pipeline data from the LeadSpot API.
   * Calls /api/insights/daily for contacts, stats, and campaigns.
   * Falls back to empty data if the backend is unavailable.
   */
  private async fetchPipelineData(organizationId: string): Promise<LeadSpotPipelineData> {
    const apiUrl = this.config!.leadspotApiUrl;

    try {
      // Fetch daily insights which includes hot leads, stats, and campaigns
      const params = new URLSearchParams({
        mautic_url: apiUrl,
        organization_id: organizationId,
      });
      const response = await fetch(`${apiUrl}/api/insights/daily?${params}`);

      if (!response.ok) {
        throw new Error(`LeadSpot API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as {
        hot_leads?: { id: string; firstname: string; lastname: string; email: string; company: string; points: number }[];
        recent_contacts?: { id: string; firstname: string; lastname: string; email: string }[];
        stats?: { total_contacts: number; total_campaigns: number };
        campaigns?: { id: string; name: string; is_published: boolean }[];
      };

      // Map backend response shape to our internal LeadSpotPipelineData shape
      const contacts: Contact[] = (data.hot_leads || []).map((lead) => ({
        id: lead.id,
        firstName: lead.firstname || '',
        lastName: lead.lastname || '',
        email: lead.email || undefined,
        score: lead.points,
        createdAt: new Date().toISOString(),
      }));

      const campaigns = (data.campaigns || []).map((c) => ({
        id: c.id,
        name: c.name,
        status: c.is_published ? 'published' : 'unpublished',
      }));

      console.log(`[CRMOrchestrator] Fetched pipeline data from ${apiUrl}: ${contacts.length} contacts, ${campaigns.length} campaigns`);

      return { contacts, deals: [], campaigns };
    } catch (error) {
      console.warn(`[CRMOrchestrator] Failed to fetch pipeline data from ${apiUrl}, using fallback:`, error);
      return { contacts: [], deals: [], campaigns: [] };
    }
  }

  /**
   * Fetch a single contact from the LeadSpot API.
   * Uses /api/insights/hot-leads and filters by contactId.
   * Falls back to a minimal stub contact if the backend is unavailable.
   */
  private async fetchContact(organizationId: string, contactId: string): Promise<Contact> {
    const apiUrl = this.config!.leadspotApiUrl;

    try {
      const params = new URLSearchParams({
        mautic_url: apiUrl,
        organization_id: organizationId,
      });
      const response = await fetch(`${apiUrl}/api/insights/hot-leads?${params}`);

      if (!response.ok) {
        throw new Error(`LeadSpot API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as {
        hot_leads?: { id: string; firstname: string; lastname: string; email: string; company: string; points: number; last_active: string | null }[];
      };

      const match = (data.hot_leads || []).find((lead) => lead.id === contactId);

      if (match) {
        console.log(`[CRMOrchestrator] Found contact ${contactId} from ${apiUrl}`);
        return {
          id: match.id,
          firstName: match.firstname || '',
          lastName: match.lastname || '',
          email: match.email || undefined,
          score: match.points,
          lastActivity: match.last_active || undefined,
          createdAt: new Date().toISOString(),
        };
      }

      // Contact not in hot leads list -- return minimal stub
      console.warn(`[CRMOrchestrator] Contact ${contactId} not found in hot leads, returning minimal record`);
      return {
        id: contactId,
        firstName: 'Unknown',
        lastName: 'Contact',
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      console.warn(`[CRMOrchestrator] Failed to fetch contact ${contactId} from ${apiUrl}, using fallback:`, error);
      return {
        id: contactId,
        firstName: 'Unknown',
        lastName: 'Contact',
        createdAt: new Date().toISOString(),
      };
    }
  }

  // ==========================================================================
  // Private: Claude AI Synthesis
  // ==========================================================================

  /**
   * Call Claude to synthesize a pipeline brief from CRM data and memory context.
   */
  private async synthesizeBrief(
    data: LeadSpotPipelineData,
    memoryContext: string,
  ): Promise<{
    summary: string;
    newLeads: number;
    followUpsNeeded: number;
    dealsAtRisk: number;
    campaignHighlights: string[];
    suggestedActions: Omit<AgentSuggestion, 'id' | 'status' | 'createdAt' | 'organizationId'>[];
  }> {
    const response = await this.client!.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are a real estate CRM assistant. Generate a pipeline brief from this data.

CRM Data:
- Contacts: ${data.contacts.length} total
- Deals: ${data.deals.length} active
- Campaigns: ${data.campaigns.length} running

Memory Context: ${memoryContext}

Contact details: ${JSON.stringify(data.contacts.slice(0, 20))}
Deal details: ${JSON.stringify(data.deals.slice(0, 20))}
Campaign details: ${JSON.stringify(data.campaigns.slice(0, 10))}

Return JSON only with:
- summary: 2-3 sentence pipeline overview
- newLeads: number of new leads (estimate from data)
- followUpsNeeded: number of contacts needing follow-up
- dealsAtRisk: number of deals that may be stalling
- campaignHighlights: array of 1-3 highlight strings
- suggestedActions: array of objects with { type, contactId, title, description, draft, priority }
  where type is one of: "email", "call", "sms", "tag", "note", "campaign"
  and priority is one of: "high", "medium", "low"

JSON only, no markdown:`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    try {
      const parsed = JSON.parse(text.trim()) as Record<string, unknown>;
      return {
        summary: typeof parsed.summary === 'string' ? parsed.summary : 'Pipeline brief generated.',
        newLeads: typeof parsed.newLeads === 'number' ? parsed.newLeads : 0,
        followUpsNeeded: typeof parsed.followUpsNeeded === 'number' ? parsed.followUpsNeeded : 0,
        dealsAtRisk: typeof parsed.dealsAtRisk === 'number' ? parsed.dealsAtRisk : 0,
        campaignHighlights: Array.isArray(parsed.campaignHighlights)
          ? (parsed.campaignHighlights as string[])
          : [],
        suggestedActions: Array.isArray(parsed.suggestedActions)
          ? (parsed.suggestedActions as Omit<AgentSuggestion, 'id' | 'status' | 'createdAt' | 'organizationId'>[])
          : [],
      };
    } catch {
      console.warn('[CRMOrchestrator] Failed to parse brief synthesis response');
      return {
        summary: 'Unable to generate brief from current data. Check LeadSpot API connection.',
        newLeads: 0,
        followUpsNeeded: 0,
        dealsAtRisk: 0,
        campaignHighlights: [],
        suggestedActions: [],
      };
    }
  }

  /**
   * Call Claude to generate AI suggestions for a specific contact.
   */
  private async generateContactSuggestions(
    contact: Contact,
    contactFacts: string,
  ): Promise<Omit<AgentSuggestion, 'id' | 'contactId' | 'status' | 'createdAt' | 'organizationId'>[]> {
    const response = await this.client!.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `You are a real estate CRM assistant. Generate actionable suggestions for this contact.

Contact: ${contact.firstName} ${contact.lastName}
Email: ${contact.email || 'N/A'}
Phone: ${contact.phone || 'N/A'}
Tags: ${(contact.tags || []).join(', ') || 'None'}
Score: ${contact.score ?? 'Not scored'}
Last Activity: ${contact.lastActivity || 'Unknown'}

Historical context: ${contactFacts}

Return a JSON array of 1-3 suggestions. Each object has:
- type: one of "email", "call", "sms", "tag", "note", "campaign"
- title: short action title
- description: 1-2 sentence description of what to do and why
- draft: if type is "email", include a draft email body; otherwise omit
- priority: "high", "medium", or "low"

JSON array only, no markdown:`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    try {
      const parsed = JSON.parse(text.trim());
      if (!Array.isArray(parsed)) throw new Error('Expected array');
      return parsed as Omit<AgentSuggestion, 'id' | 'contactId' | 'status' | 'createdAt' | 'organizationId'>[];
    } catch {
      console.warn('[CRMOrchestrator] Failed to parse contact suggestions response');
      return [];
    }
  }

  // ==========================================================================
  // Private: Helpers
  // ==========================================================================

  /**
   * Add a suggestion to the in-memory store for an organization.
   */
  private addSuggestion(organizationId: string, suggestion: AgentSuggestion): void {
    insertSuggestion(organizationId, suggestion);
  }

  /**
   * Guard that throws if the orchestrator has not been initialized.
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.client || !this.config) {
      throw new Error('[CRMOrchestrator] Not initialized. Call initialize() first.');
    }
  }
}

// ============================================================================
// Singleton & Factory
// ============================================================================

let instance: CRMOrchestrator | null = null;

/**
 * Get or create the singleton CRMOrchestrator instance.
 */
export function getOrchestrator(): CRMOrchestrator {
  if (!instance) {
    instance = new CRMOrchestrator();
  }
  return instance;
}

/**
 * Create and initialize a new CRMOrchestrator.
 * Returns the singleton instance if already initialized.
 */
export async function createOrchestrator(config: AgentServiceConfig): Promise<CRMOrchestrator> {
  const orchestrator = getOrchestrator();
  await orchestrator.initialize(config);
  return orchestrator;
}
