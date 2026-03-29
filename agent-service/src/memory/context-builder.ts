/**
 * Memory Context Builder for LeadSpot Agent Service
 *
 * Builds the memory context that gets injected into the AI agent's prompts
 * when interacting with or making suggestions about a contact.
 *
 * Adapted from Johnny5's memory-context-builder, simplified for CRM use:
 * - No pattern detection service (Phase 1)
 * - No ManusLive integration
 * - Contact-level context (facts + suggestions)
 * - Organization-level brief context (cross-contact intelligence)
 */

import type {
  ExtractedFact,
  MemoryContext,
  AgentSuggestion,
} from '../types';
import { getDb } from '../db';
import { getRelevantFacts, getExistingFacts } from './fact-extraction';

// ============================================================================
// Types
// ============================================================================

/** Labels for fact types, used in formatted output */
const FACT_TYPE_LABELS: Record<string, string> = {
  personal: 'Personal Info',
  preference: 'Preferences',
  project: 'Projects & Initiatives',
  technical: 'Technical Details',
  goal: 'Goals & Pain Points',
  interaction: 'Interaction Patterns',
};

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Get recent suggestions for a contact from the database.
 * Returns formatted strings summarizing suggestion history.
 */
function getRecentSuggestions(
  organizationId: string,
  contactId: string,
  limit: number = 5
): string[] {
  const db = getDb(organizationId);

  const stmt = db.prepare(`
    SELECT type, title, status, created_at
    FROM suggestions
    WHERE organization_id = ? AND contact_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

  const rows = stmt.all(organizationId, contactId, limit) as Array<{
    type: string;
    title: string;
    status: string;
    created_at: string;
  }>;

  return rows.map(row => {
    const statusIcon = row.status === 'approved' ? '[approved]'
      : row.status === 'dismissed' ? '[dismissed]'
      : row.status === 'executed' ? '[executed]'
      : '[pending]';
    return `${statusIcon} ${row.type}: ${row.title} (${row.created_at})`;
  });
}

/**
 * Get recent interaction summaries for a contact.
 * Pulls from a lightweight interactions log if available.
 */
function getRecentInteractions(
  organizationId: string,
  contactId: string,
  limit: number = 5
): string[] {
  const db = getDb(organizationId);

  try {
    const stmt = db.prepare(`
      SELECT type, title || ': ' || COALESCE(description, '') AS summary, created_at
      FROM timeline_events
      WHERE organization_id = ? AND contact_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(organizationId, contactId, limit) as Array<{
      type: string;
      summary: string;
      created_at: string;
    }>;

    return rows.map(row => `[${row.type}] ${row.summary} (${row.created_at})`);
  } catch {
    // Table may not exist yet -- non-critical
    return [];
  }
}

/**
 * Group facts by type for readable prompt formatting.
 */
function groupFactsByType(
  facts: ExtractedFact[]
): Record<string, ExtractedFact[]> {
  return facts.reduce<Record<string, ExtractedFact[]>>((acc, fact) => {
    if (!acc[fact.type]) acc[fact.type] = [];
    acc[fact.type].push(fact);
    return acc;
  }, {});
}

/**
 * Get suggestion outcome ratios for an organization.
 * Returns a summary string with approval/dismissal stats.
 */
function getSuggestionOutcomes(organizationId: string): string {
  const db = getDb(organizationId);

  try {
    const stmt = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM suggestions
      WHERE organization_id = ?
      GROUP BY status
    `);

    const rows = stmt.all(organizationId) as Array<{
      status: string;
      count: number;
    }>;

    if (rows.length === 0) return 'No suggestion history yet.';

    const counts: Record<string, number> = {};
    let total = 0;
    for (const row of rows) {
      counts[row.status] = row.count;
      total += row.count;
    }

    const approved = counts['approved'] ?? 0;
    const executed = counts['executed'] ?? 0;
    const dismissed = counts['dismissed'] ?? 0;
    const acceptRate = total > 0
      ? Math.round(((approved + executed) / total) * 100)
      : 0;

    return `Suggestion stats: ${total} total, ${approved + executed} accepted (${acceptRate}%), ${dismissed} dismissed`;
  } catch {
    return 'No suggestion history available.';
  }
}

// ============================================================================
// Exported Functions
// ============================================================================

/**
 * Build the full memory context for a specific contact.
 *
 * Assembles all relevant memory (facts, interactions, suggestions)
 * into a MemoryContext object for AI prompt injection.
 *
 * @param organizationId - Organization scope
 * @param contactId - The contact to build context for
 * @param currentMessage - Optional current message for relevance matching
 */
export async function buildContactContext(
  organizationId: string,
  contactId: string,
  currentMessage?: string
): Promise<MemoryContext> {
  console.log(`[ContextBuilder] Building context for contact=${contactId}, org=${organizationId}`);

  // Get relevant facts -- use keyword matching if we have a current message
  let facts: ExtractedFact[];
  if (currentMessage) {
    facts = await getRelevantFacts(organizationId, contactId, currentMessage, 15);
  } else {
    // Get all facts for the contact, ordered by confidence
    const existingFacts = await getExistingFacts(organizationId, contactId, 15);
    // Convert ExistingFact[] to ExtractedFact[] with defaults
    facts = existingFacts.map(f => ({
      type: 'personal' as const,
      key: f.fact_key,
      value: f.fact_value,
      confidence: 1.0,
    }));
  }

  // Get recent interactions and suggestions (synchronous DB calls)
  const recentInteractions = getRecentInteractions(organizationId, contactId);
  const suggestions = getRecentSuggestions(organizationId, contactId);

  const context: MemoryContext = {
    facts,
    recentInteractions,
    suggestions,
  };

  console.log(`[ContextBuilder] Built context: ${facts.length} facts, ${recentInteractions.length} interactions, ${suggestions.length} suggestions`);

  return context;
}

/**
 * Build a brief context string for generating an organization-level pipeline brief.
 *
 * Aggregates high-confidence facts across all contacts and includes
 * suggestion outcome stats to help the AI calibrate its recommendations.
 *
 * @param organizationId - Organization scope
 */
export async function buildBriefContext(
  organizationId: string
): Promise<string> {
  console.log(`[ContextBuilder] Building brief context for org=${organizationId}`);

  const db = getDb(organizationId);
  const lines: string[] = ['## Organization Intelligence'];

  // Get high-confidence facts across all contacts
  try {
    const factsStmt = db.prepare(`
      SELECT contact_id, fact_type, fact_key, fact_value, confidence
      FROM extracted_facts
      WHERE organization_id = ? AND confidence >= 0.8
      ORDER BY confidence DESC, reference_count DESC
      LIMIT 30
    `);

    const allFacts = factsStmt.all(organizationId) as Array<{
      contact_id: string;
      fact_type: string;
      fact_key: string;
      fact_value: string;
      confidence: number;
    }>;

    if (allFacts.length > 0) {
      // Group by contact for readability
      const byContact: Record<string, typeof allFacts> = {};
      for (const fact of allFacts) {
        if (!byContact[fact.contact_id]) byContact[fact.contact_id] = [];
        byContact[fact.contact_id].push(fact);
      }

      lines.push('');
      lines.push('### Key Contact Intelligence');
      for (const [contactId, contactFacts] of Object.entries(byContact)) {
        lines.push(`**Contact ${contactId}:**`);
        for (const fact of contactFacts) {
          lines.push(`  - ${fact.fact_key}: ${fact.fact_value}`);
        }
      }
    }
  } catch {
    lines.push('No contact intelligence available yet.');
  }

  // Add suggestion outcome stats
  lines.push('');
  lines.push('### Suggestion Performance');
  lines.push(getSuggestionOutcomes(organizationId));

  const result = lines.join('\n');
  console.log(`[ContextBuilder] Built brief context (${result.length} chars)`);

  return result;
}

/**
 * Format a MemoryContext object into a string suitable for prompt injection.
 *
 * Produces a clean, structured text block that can be appended to
 * the AI agent's system prompt.
 *
 * @param context - The MemoryContext to format
 */
export function formatContextForPrompt(context: MemoryContext): string {
  const sections: string[] = [];

  // Facts section -- grouped by type
  if (context.facts.length > 0) {
    const grouped = groupFactsByType(context.facts);
    const factLines: string[] = ['## What We Know About This Contact'];

    for (const [type, typeFacts] of Object.entries(grouped)) {
      const label = FACT_TYPE_LABELS[type] ?? type;
      factLines.push(`**${label}:**`);
      for (const fact of typeFacts) {
        factLines.push(`- ${fact.key}: ${fact.value}`);
      }
    }

    sections.push(factLines.join('\n'));
  }

  // Recent interactions section
  if (context.recentInteractions.length > 0) {
    const interactionLines = [
      '## Recent Interactions',
      ...context.recentInteractions.map(i => `- ${i}`),
    ];
    sections.push(interactionLines.join('\n'));
  }

  // Suggestions section
  if (context.suggestions.length > 0) {
    const suggestionLines = [
      '## Recent Suggestions',
      ...context.suggestions.map(s => `- ${s}`),
    ];
    sections.push(suggestionLines.join('\n'));
  }

  if (sections.length === 0) {
    return '';
  }

  return sections.join('\n\n');
}
