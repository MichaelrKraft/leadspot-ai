/**
 * Fact Extraction Service for LeadSpot Agent Service
 *
 * Extracts facts from CRM interactions using Claude AI (Haiku for cost efficiency).
 * Adapted from Johnny5's fact-extraction-service for CRM context:
 * - Facts are per-contact, per-organization (not per-user)
 * - Focuses on extracting intel about contacts/leads
 * - Adds 'interaction' fact type for CRM interaction patterns
 *
 * Key Features:
 * - Extracts explicit facts from conversations (never assumes)
 * - Assigns confidence scores based on how directly stated
 * - Categorizes: personal, preference, project, technical, goal, interaction
 * - Avoids duplicates by checking existing facts
 * - Regex fallback when API key is unavailable
 */

import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import type {
  ExtractedFact,
  ConversationMessage,
  ExistingFact,
} from '../types';
import { getDb } from '../db';

// ============================================================================
// Constants
// ============================================================================

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const VALID_FACT_TYPES: ReadonlyArray<ExtractedFact['type']> = [
  'personal',
  'preference',
  'project',
  'technical',
  'goal',
  'interaction',
];

// ============================================================================
// Extraction Prompt
// ============================================================================

const EXTRACTION_PROMPT = `You are a memory extraction system for a CRM AI agent.
Your job is to extract EXPLICIT facts about a contact/lead from CRM interactions.

## RULES
1. Only extract information that is EXPLICITLY STATED, never assume or infer
2. Assign confidence based on how directly the information was stated:
   - 0.95-1.0: Directly stated ("My name is Sarah", "We need 50 licenses")
   - 0.80-0.94: Strongly implied from direct statements ("Been in SaaS for 10 years")
   - 0.60-0.79: Reasonably implied ("Working with a small team" implies small business)
   - Below 0.6: Don't extract, too uncertain
3. Use specific, searchable keys (e.g., "contact_company" not "company")
4. Keep values concise but complete
5. If information contradicts a previous fact, extract the correction

## FACT TYPES
- personal: Contact's personal info (name, title, role, background)
- preference: Communication preferences, preferred channels, timing preferences
- project: Current projects, initiatives, what they're evaluating/buying
- technical: Technical requirements, stack, integrations needed
- goal: Business goals, pain points, what they're trying to achieve
- interaction: Interaction patterns (response times, engagement level, sentiment)

## OUTPUT FORMAT
Return a JSON array of facts. If no new facts found, return empty array [].

\`\`\`json
[
  {
    "type": "personal",
    "key": "contact_title",
    "value": "VP of Marketing",
    "confidence": 0.95
  },
  {
    "type": "goal",
    "key": "primary_pain_point",
    "value": "Struggling with lead qualification and follow-up timing",
    "confidence": 0.85
  }
]
\`\`\`

## IMPORTANT
- ONLY return the JSON array, no other text
- Do NOT re-extract facts that are already known (provided below)
- Focus on NEW information from the interaction
- Extract facts about the CONTACT, not about the CRM user/agent

ALREADY KNOWN FACTS (do not re-extract):
{existingFacts}

INTERACTION TO ANALYZE:
{conversation}

Extract facts from this interaction:`;

// ============================================================================
// Client Initialization
// ============================================================================

/** Lazily create the Anthropic client */
function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[FactExtraction] ANTHROPIC_API_KEY not set, fact extraction disabled');
    return null;
  }
  return new Anthropic({ apiKey });
}

// ============================================================================
// Formatting Helpers
// ============================================================================

/** Format conversation messages for the extraction prompt */
function formatConversation(messages: ConversationMessage[]): string {
  // Take last 10 messages for context (balance between context and cost)
  const recentMessages = messages.slice(-10);
  return recentMessages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');
}

/** Format existing facts to avoid re-extraction */
function formatExistingFacts(facts: ExistingFact[]): string {
  if (facts.length === 0) {
    return 'None';
  }
  return facts
    .slice(0, 20)
    .map(f => `- ${f.fact_key}: ${f.fact_value}`)
    .join('\n');
}

// ============================================================================
// Response Parsing
// ============================================================================

/** Parse extraction response from Claude */
function parseExtractionResponse(text: string): ExtractedFact[] {
  try {
    // Try to find JSON array in the response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log('[FactExtraction] No JSON array found in response');
      return [];
    }

    const parsed: unknown = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) {
      console.warn('[FactExtraction] Parsed result is not an array');
      return [];
    }

    // Validate and filter facts
    return parsed.filter((fact: unknown): fact is ExtractedFact => {
      if (!fact || typeof fact !== 'object') return false;
      const f = fact as Record<string, unknown>;
      return (
        typeof f.type === 'string' &&
        VALID_FACT_TYPES.includes(f.type as ExtractedFact['type']) &&
        typeof f.key === 'string' &&
        (f.key as string).length > 0 &&
        typeof f.value === 'string' &&
        (f.value as string).length > 0 &&
        typeof f.confidence === 'number' &&
        (f.confidence as number) >= 0.6 &&
        (f.confidence as number) <= 1.0
      );
    });
  } catch (error) {
    console.error('[FactExtraction] Failed to parse response:', error);
    return [];
  }
}

// ============================================================================
// Regex Fallback
// ============================================================================

/**
 * Regex-based fact extraction fallback.
 * Used when ANTHROPIC_API_KEY is unavailable.
 * Catches obvious statements from conversation messages.
 */
function extractFactsWithRegex(
  messages: ConversationMessage[],
  existingFacts: ExistingFact[] = []
): ExtractedFact[] {
  const existingKeys = new Set(existingFacts.map(f => f.fact_key));
  const facts: ExtractedFact[] = [];
  const seen = new Set<string>();

  // Analyze all messages (both user and assistant may contain contact info)
  const patterns: Array<{
    regex: RegExp;
    type: ExtractedFact['type'];
    key: string;
    confidence: number;
  }> = [
    // Contact name patterns
    { regex: /\bmy name is ([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/i, type: 'personal', key: 'contact_name', confidence: 0.95 },
    { regex: /\bcall me ([A-Z][a-z]+)/i, type: 'personal', key: 'contact_name', confidence: 0.9 },

    // Company patterns
    { regex: /\bi(?:'m| am) (?:with|from|at) ([^\.,!?]{2,40})/i, type: 'personal', key: 'contact_company', confidence: 0.85 },
    { regex: /\bour company(?:\s+is|\,)?\s+([^\.,!?]{2,40})/i, type: 'personal', key: 'contact_company', confidence: 0.85 },

    // Role / title
    { regex: /\bi(?:'m| am) (?:the |a )?([a-z][a-z\s]{2,30}(?:manager|director|vp|ceo|cto|cfo|founder|owner|lead|head|chief|president|analyst|coordinator))/i, type: 'personal', key: 'contact_title', confidence: 0.85 },

    // Team size
    { regex: /\bwe have (\d+(?:\s*[-to]+\s*\d+)?)\s*(?:people|employees|team members|reps|agents)/i, type: 'personal', key: 'team_size', confidence: 0.8 },

    // Budget patterns
    { regex: /\bour budget is ([^\.,!?]{3,30})/i, type: 'project', key: 'budget_range', confidence: 0.85 },
    { regex: /\blooking to spend ([^\.,!?]{3,30})/i, type: 'project', key: 'budget_range', confidence: 0.8 },

    // Goals / pain points
    { regex: /\bwe need (?:to )?([^\.,!?]{5,60})/i, type: 'goal', key: 'primary_need', confidence: 0.8 },
    { regex: /\bour (?:main |biggest )?(?:challenge|problem|issue) is ([^\.,!?]{5,60})/i, type: 'goal', key: 'primary_pain_point', confidence: 0.85 },
    { regex: /\bwe(?:'re| are) (?:trying|looking|wanting) to ([^\.,!?]{5,60})/i, type: 'goal', key: 'contact_goal', confidence: 0.75 },

    // Technical requirements
    { regex: /\bwe (?:currently )?use ([^\.,!?]{2,40})/i, type: 'technical', key: 'current_tools', confidence: 0.8 },
    { regex: /\bwe need (?:it to )?integrat(?:e|ion) with ([^\.,!?]{2,40})/i, type: 'technical', key: 'integration_needs', confidence: 0.8 },

    // Timeline
    { regex: /\bwe need (?:this|it) by ([^\.,!?]{3,30})/i, type: 'project', key: 'timeline', confidence: 0.85 },
    { regex: /\blooking to (?:start|launch|go live) (?:in |by )?([^\.,!?]{3,30})/i, type: 'project', key: 'timeline', confidence: 0.8 },

    // Preferences
    { regex: /\bi prefer ([^\.,!?]{3,40})/i, type: 'preference', key: 'contact_preference', confidence: 0.85 },
    { regex: /\bbest (?:time|way) to reach me is ([^\.,!?]{3,40})/i, type: 'preference', key: 'contact_channel_preference', confidence: 0.85 },
  ];

  for (const msg of messages) {
    for (const pattern of patterns) {
      const match = msg.content.match(pattern.regex);
      if (!match) continue;

      const key = pattern.key;
      let value = match[1].trim().replace(/[\s.!?,;:]+$/, '').trim();

      // Skip if empty, too short, or already known
      if (!value || value.length < 2) continue;
      if (existingKeys.has(key)) continue;
      if (seen.has(key)) continue;

      seen.add(key);
      facts.push({
        type: pattern.type,
        key,
        value,
        confidence: pattern.confidence,
      });
    }
  }

  if (facts.length > 0) {
    console.log(
      `[FactExtraction] Regex fallback extracted ${facts.length} facts:`,
      facts.map(f => `${f.key}=${f.value}`).join(', ')
    );
  }

  return facts;
}

// ============================================================================
// Core Service Functions
// ============================================================================

/**
 * Extract facts from a CRM interaction using Claude Haiku.
 *
 * @param messages - The conversation messages to analyze
 * @param contactId - The contact this interaction is about
 * @param organizationId - The organization owning this contact
 * @param existingFacts - Facts already known (to avoid duplicates)
 * @returns Array of newly extracted facts
 */
export async function extractFactsFromInteraction(
  messages: ConversationMessage[],
  contactId: string,
  organizationId: string,
  existingFacts: ExistingFact[] = []
): Promise<ExtractedFact[]> {
  console.log(`[FactExtraction] Starting extraction for contact=${contactId}, org=${organizationId}`);

  const client = getAnthropicClient();
  if (!client) {
    console.warn('[FactExtraction] Anthropic client not available, using regex fallback');
    return extractFactsWithRegex(messages, existingFacts);
  }

  // Skip if conversation is too short
  if (messages.length < 2) {
    console.log('[FactExtraction] Conversation too short, skipping');
    return [];
  }

  try {
    const prompt = EXTRACTION_PROMPT
      .replace('{existingFacts}', formatExistingFacts(existingFacts))
      .replace('{conversation}', formatConversation(messages));

    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 1024,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract text from response content blocks
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('');

    const facts = parseExtractionResponse(text);
    console.log(`[FactExtraction] Extracted ${facts.length} facts for contact=${contactId}`);

    return facts;
  } catch (error) {
    console.error('[FactExtraction] Claude API error:', error);
    // Fall back to regex extraction on API failure
    return extractFactsWithRegex(messages, existingFacts);
  }
}

/**
 * Save extracted facts to the database.
 *
 * Uses UPSERT semantics: if a fact with the same org+contact+key exists,
 * it updates the value and bumps reference_count.
 *
 * @param organizationId - Organization scope
 * @param contactId - Contact these facts belong to
 * @param facts - The facts to save
 * @param source - Optional source identifier (e.g., "email", "call", "chat")
 */
export async function saveFacts(
  organizationId: string,
  contactId: string,
  facts: ExtractedFact[],
  source?: string
): Promise<void> {
  if (facts.length === 0) return;

  console.log(`[FactExtraction] Saving ${facts.length} facts for contact=${contactId}`);

  const db = getDb(organizationId);
  const now = new Date().toISOString();

  const insertStmt = db.prepare(`
    INSERT INTO extracted_facts (
      id, organization_id, contact_id, fact_type, fact_key, fact_value,
      confidence, source, created_at, last_referenced, reference_count
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    ON CONFLICT(organization_id, contact_id, fact_key) DO UPDATE SET
      fact_value = excluded.fact_value,
      confidence = MAX(confidence, excluded.confidence),
      source = excluded.source,
      last_referenced = excluded.created_at,
      reference_count = reference_count + 1
  `);

  const insertMany = db.transaction((factsToInsert: ExtractedFact[]) => {
    for (const fact of factsToInsert) {
      insertStmt.run(
        randomUUID(),
        organizationId,
        contactId,
        fact.type,
        fact.key,
        fact.value,
        fact.confidence,
        source ?? null,
        now,
        now
      );
    }
  });

  try {
    insertMany(facts);
    console.log(`[FactExtraction] Saved ${facts.length} facts successfully`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[FactExtraction] Database error saving facts: ${message}`);
  }
}

/**
 * Get existing facts from the database.
 *
 * @param organizationId - Organization scope
 * @param contactId - Optional: filter by contact
 * @param limit - Maximum number of facts to return
 */
export async function getExistingFacts(
  organizationId: string,
  contactId?: string,
  limit: number = 50
): Promise<ExistingFact[]> {
  const db = getDb(organizationId);

  if (contactId) {
    const stmt = db.prepare(`
      SELECT fact_key, fact_value
      FROM extracted_facts
      WHERE organization_id = ? AND contact_id = ?
      ORDER BY confidence DESC, reference_count DESC
      LIMIT ?
    `);
    return stmt.all(organizationId, contactId, limit) as ExistingFact[];
  }

  const stmt = db.prepare(`
    SELECT fact_key, fact_value
    FROM extracted_facts
    WHERE organization_id = ?
    ORDER BY confidence DESC, reference_count DESC
    LIMIT ?
  `);
  return stmt.all(organizationId, limit) as ExistingFact[];
}

/**
 * Get relevant facts for a given query/context using keyword matching.
 *
 * @param organizationId - Organization scope
 * @param contactId - Contact to get facts for
 * @param query - The message or context to match against
 * @param limit - Maximum number of facts to return
 */
export async function getRelevantFacts(
  organizationId: string,
  contactId: string,
  query: string,
  limit: number = 10
): Promise<ExtractedFact[]> {
  const db = getDb(organizationId);

  // Extract keywords (words longer than 3 chars)
  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);

  if (keywords.length === 0) {
    // Return most referenced facts for this contact if no keywords
    const stmt = db.prepare(`
      SELECT fact_type as type, fact_key as key, fact_value as value, confidence
      FROM extracted_facts
      WHERE organization_id = ? AND contact_id = ?
      ORDER BY reference_count DESC, confidence DESC
      LIMIT ?
    `);
    return stmt.all(organizationId, contactId, limit) as ExtractedFact[];
  }

  // Build keyword-based relevance query
  const likeConditions = keywords
    .map(() => `(LOWER(fact_key) LIKE ? OR LOWER(fact_value) LIKE ?)`)
    .join(' OR ');
  const params = keywords.flatMap(k => [`%${k}%`, `%${k}%`]);

  const stmt = db.prepare(`
    SELECT fact_type as type, fact_key as key, fact_value as value, confidence
    FROM extracted_facts
    WHERE organization_id = ? AND contact_id = ? AND (${likeConditions})
    ORDER BY confidence DESC, reference_count DESC
    LIMIT ?
  `);

  return stmt.all(organizationId, contactId, ...params, limit) as ExtractedFact[];
}

/**
 * Clean up old, low-confidence facts that have never been referenced.
 *
 * @param organizationId - Organization scope
 * @param olderThanDays - Delete facts older than this many days (default: 90)
 * @returns Number of facts deleted
 */
export async function cleanupStaleFacts(
  organizationId: string,
  olderThanDays: number = 90
): Promise<number> {
  const db = getDb(organizationId);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const stmt = db.prepare(`
    DELETE FROM extracted_facts
    WHERE organization_id = ?
      AND created_at < ?
      AND confidence < 0.7
      AND reference_count = 0
  `);

  const result = stmt.run(organizationId, cutoffDate.toISOString());
  console.log(`[FactExtraction] Cleaned up ${result.changes} stale facts for org=${organizationId}`);
  return result.changes;
}
