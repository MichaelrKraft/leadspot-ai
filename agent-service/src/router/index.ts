/**
 * CRM Task Router
 *
 * Classifies incoming tasks and routes them to the appropriate CRM crew member.
 * Uses a dual approach: fast keyword matching first, then Claude Haiku fallback
 * for ambiguous tasks.
 *
 * Adapted from Johnny5's task-router for real estate CRM use cases.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { TaskClassification, TaskComplexity, CrewMemberSpec } from '../types';

// ============================================================================
// CRM Crew Member Specifications
// ============================================================================

/**
 * Real estate CRM crew members with routing keywords.
 * Each member handles a specific domain of CRM operations.
 */
const CRM_CREW_SPECS: CrewMemberSpec[] = [
  {
    id: 'lead-qualifier',
    name: 'Lead Qualifier',
    category: 'sales',
    description: 'Score and prioritize leads, qualify prospects, suggest follow-up timing',
    keywords: [
      'lead', 'score', 'qualify', 'prospect', 'follow-up',
      'hot', 'warm', 'cold', 'pipeline', 'deal',
      'priority', 'conversion',
    ],
  },
  {
    id: 'email-copywriter',
    name: 'Email Copywriter',
    category: 'content',
    description: 'Draft follow-up emails, nurture sequences, listing announcements',
    keywords: [
      'write', 'draft', 'email', 'follow-up', 'nurture',
      'template', 'sequence', 'copy', 'listing', 'announcement',
      'open house',
    ],
  },
  {
    id: 'crm-analyst',
    name: 'CRM Analyst',
    category: 'analytics',
    description: 'Pipeline reports, morning briefs, conversion analytics, market trends',
    keywords: [
      'report', 'brief', 'analytics', 'metrics', 'conversion',
      'pipeline', 'forecast', 'trend', 'performance', 'summary',
      'dashboard',
    ],
  },
  {
    id: 'campaign-strategist',
    name: 'Campaign Strategist',
    category: 'strategy',
    description: 'Campaign optimization, A/B testing, drip sequence design',
    keywords: [
      'campaign', 'strategy', 'optimize', 'segment', 'target',
      'drip', 'automation', 'a/b', 'test', 'audience',
      'nurture',
    ],
  },
  {
    id: 'crm-assistant',
    name: 'CRM Assistant',
    category: 'operations',
    description: 'Update records, manage tags, schedule tasks, data entry',
    keywords: [
      'update', 'tag', 'schedule', 'task', 'reminder',
      'note', 'record', 'organize', 'clean', 'assign',
      'transfer',
    ],
  },
];

// ============================================================================
// Complexity Patterns
// ============================================================================

const COMPLEXITY_PATTERNS = {
  simple: [
    'quick', 'simple', 'minor', 'small', 'brief',
    'short', 'basic', 'one', 'single', 'just',
  ],
  complex: [
    'comprehensive', 'detailed', 'thorough', 'extensive', 'complete',
    'deep dive', 'full', 'entire', 'all', 'analysis',
    'strategy', 'roadmap', 'campaign', 'architecture',
  ],
};

// ============================================================================
// CRM Task Router Class
// ============================================================================

/**
 * Routes CRM tasks to the appropriate crew member using keyword matching
 * with an AI classification fallback via Claude Haiku.
 *
 * @example
 * ```typescript
 * const router = createTaskRouter(process.env.ANTHROPIC_API_KEY!);
 * const result = await router.classify('Score the new leads from today');
 * console.log(result.crewMember); // 'lead-qualifier'
 * ```
 */
export class CRMTaskRouter {
  private client: Anthropic;

  constructor(private anthropicApiKey: string) {
    this.client = new Anthropic({ apiKey: anthropicApiKey });
  }

  /**
   * Classify a task and route it to the appropriate crew member.
   * Tries fast keyword matching first; falls back to Claude Haiku for ambiguous tasks.
   */
  async classify(taskDescription: string): Promise<TaskClassification> {
    // Try fast keyword-based classification first
    const quickMatch = this.quickClassify(taskDescription);

    // High confidence from keywords -- use it directly
    if (quickMatch.confidence >= 0.8) {
      return quickMatch;
    }

    // Fall back to AI classification for ambiguous tasks
    try {
      return await this.aiClassify(taskDescription, quickMatch);
    } catch (error) {
      console.warn('[CRMTaskRouter] AI classification failed, using keyword fallback:', error);
      return quickMatch;
    }
  }

  /**
   * Fast keyword-based classification without an AI call.
   * Scores each crew member by counting keyword matches in the task description.
   */
  private quickClassify(taskDescription: string): TaskClassification {
    const lower = taskDescription.toLowerCase();

    // Score each crew member by keyword match count
    const scores = CRM_CREW_SPECS.map((spec) => {
      const matchCount = spec.keywords.filter((kw) => lower.includes(kw)).length;
      return {
        id: spec.id,
        score: matchCount,
        category: spec.category,
      };
    });

    scores.sort((a, b) => b.score - a.score);

    const best = scores[0];
    const maxPossibleScore = Math.max(...CRM_CREW_SPECS.map((s) => s.keywords.length), 1);

    // Confidence: weighted blend of match ratio and separation from runner-up
    const confidence = Math.min(
      0.95,
      (best.score / maxPossibleScore) * 0.6 +
        ((best.score - (scores[1]?.score || 0)) / maxPossibleScore) * 0.4,
    );

    const complexity = this.determineComplexity(lower);

    // Parallel candidates: other crew members with keyword hits in different categories
    const parallelCandidates = scores
      .slice(1)
      .filter((s) => s.score > 0 && s.category !== best.category)
      .map((s) => s.id);

    return {
      crewMember: best.id,
      complexity,
      confidence: Math.max(0.3, confidence),
      parallelCandidates: parallelCandidates.length > 0 ? parallelCandidates : undefined,
    };
  }

  /**
   * AI-powered classification using Claude Haiku for nuanced task routing.
   */
  private async aiClassify(
    taskDescription: string,
    fallback: TaskClassification,
  ): Promise<TaskClassification> {
    const crewList = CRM_CREW_SPECS.map(
      (s) => `- ${s.id}: ${s.name} - ${s.description}`,
    ).join('\n');

    const response = await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: `Classify this CRM task and return JSON only.

Task: "${taskDescription}"

Available crew members:
${crewList}

Return JSON with:
- crewMember: best crew member ID from the list above
- complexity: "simple", "standard", or "complex"
- confidence: 0.0 to 1.0
- parallelCandidates: array of other crew member IDs that could help (optional)
- reasoning: one sentence explanation

JSON only, no markdown:`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    try {
      const parsed: Record<string, unknown> = JSON.parse(text.trim());

      // Validate crew member ID exists
      const validCrewIds = CRM_CREW_SPECS.map((s) => s.id);
      if (typeof parsed.crewMember !== 'string' || !validCrewIds.includes(parsed.crewMember)) {
        throw new Error(`Invalid crew member: ${String(parsed.crewMember)}`);
      }

      // Validate and filter parallel candidates
      const rawCandidates = Array.isArray(parsed.parallelCandidates)
        ? (parsed.parallelCandidates as string[]).filter((id) => validCrewIds.includes(id))
        : undefined;

      return {
        crewMember: parsed.crewMember,
        complexity: this.validateComplexity(parsed.complexity),
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.7)),
        parallelCandidates: rawCandidates && rawCandidates.length > 0 ? rawCandidates : undefined,
        reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : undefined,
      };
    } catch (parseError) {
      console.warn('[CRMTaskRouter] Failed to parse AI classification response:', parseError);
      return fallback;
    }
  }

  /**
   * Determine task complexity from keyword patterns in the description.
   */
  private determineComplexity(lowerDescription: string): TaskComplexity {
    const simpleMatches = COMPLEXITY_PATTERNS.simple.filter((p) =>
      lowerDescription.includes(p),
    ).length;

    const complexMatches = COMPLEXITY_PATTERNS.complex.filter((p) =>
      lowerDescription.includes(p),
    ).length;

    if (complexMatches > simpleMatches) return 'complex';
    if (simpleMatches > complexMatches) return 'simple';
    return 'standard';
  }

  /**
   * Validate and normalize a complexity value from AI output.
   */
  private validateComplexity(complexity: unknown): TaskComplexity {
    if (complexity === 'simple' || complexity === 'standard' || complexity === 'complex') {
      return complexity;
    }
    return 'standard';
  }

  /**
   * Get all available crew member IDs.
   */
  getCrewMemberIds(): string[] {
    return CRM_CREW_SPECS.map((s) => s.id);
  }

  /**
   * Get a crew member specification by ID.
   */
  getCrewMemberSpec(id: string): CrewMemberSpec | undefined {
    return CRM_CREW_SPECS.find((s) => s.id === id);
  }

  /**
   * Get all crew member specifications.
   */
  getAllCrewSpecs(): CrewMemberSpec[] {
    return [...CRM_CREW_SPECS];
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a CRMTaskRouter instance.
 *
 * @param apiKey - Anthropic API key for AI classification fallback
 */
export function createTaskRouter(apiKey: string): CRMTaskRouter {
  return new CRMTaskRouter(apiKey);
}
