/**
 * useQuery Hook
 * Handles query submission using local AI (sentence-transformers + Ollama)
 * No API keys required - everything runs locally
 */

'use client';

import { useState } from 'react';
import { QueryRequest, QueryResponse, QueryHistoryItem } from '@/types/query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Demo responses organized by industry
type IndustryResponses = Record<string, QueryResponse>;

// Bond trading demo responses
const BONDS_RESPONSES: IndustryResponses = {
  'default': {
    query_id: 'demo-query-1',
    answer: `Based on your knowledge base, here's what I found:

**Municipal Bond Best Execution Requirements**

Under MSRB Rule G-18, dealers must use reasonable diligence to ascertain the best market for a municipal security and buy or sell in that market so the resulting price is as favorable as possible under prevailing market conditions.

**Key Requirements:**
1. **Price Discovery** - Check multiple dealers and alternative trading systems (ATS) before execution
2. **Documentation** - Maintain records of price quotes obtained and rationale for execution venue selection
3. **Client Communication** - Disclose markup/markdown on riskless principal transactions

**FINRA Guidance:**
Per FINRA Notice 15-46, firms should consider:
- Recent transaction prices reported to TRACE
- Yields on comparable securities
- Market conditions at time of execution

Your compliance team should review the Q4 2024 MSRB Regulatory Update for the latest guidance on markup disclosure requirements.`,
    sources: [
      {
        document_id: 'doc-msrb-g18',
        title: 'MSRB Rule G-18: Best Execution Guidelines',
        url: '/documents/doc-msrb-g18',
        excerpt: 'Rule G-18 requires dealers to use reasonable diligence to ascertain the best market for the subject security...',
        relevance_score: 0.95,
        source_system: 'MSRB Rulebook',
        mime_type: 'application/pdf'
      },
      {
        document_id: 'doc-finra-15-46',
        title: 'FINRA Regulatory Notice 15-46: Fixed Income Best Execution',
        url: '/documents/doc-finra-15-46',
        excerpt: 'This Notice reminds firms of their best execution obligations when executing customer transactions...',
        relevance_score: 0.91,
        source_system: 'FINRA Notices',
        mime_type: 'application/pdf'
      },
      {
        document_id: 'doc-compliance-manual',
        title: 'Internal Compliance Manual - Fixed Income Trading',
        url: '/documents/doc-compliance-manual',
        excerpt: 'Section 4.2: Best execution procedures require traders to obtain at least 3 competitive quotes...',
        relevance_score: 0.88,
        source_system: 'Internal Docs',
        mime_type: 'application/pdf'
      }
    ],
    response_time_ms: 1247,
    confidence: 0.91,
    metadata: {
      model_used: 'llama3.2',
      tokens_used: 847,
      ollama_available: true
    },
    follow_up_questions: [
      'What are the markup disclosure requirements for municipal bonds?',
      'How do we document best execution for illiquid securities?',
      'What ATS platforms should we use for municipal bond trading?'
    ]
  },
  'margin': {
    query_id: 'demo-query-margin',
    answer: `Based on your knowledge base, here's the current margin requirement information:

**FINRA Rule 4210 Margin Requirements for Corporate Bonds**

**Investment Grade (BBB- and above):**
- Initial Margin: 20% of market value
- Maintenance Margin: 15% of market value

**High Yield (Below BBB-):**
- Initial Margin: 30% of market value
- Maintenance Margin: 25% of market value

**Convertible Bonds:**
- Initial Margin: 25% of market value (or underlying equity requirement if higher)
- Maintenance Margin: 20% of market value

**Recent Updates (2024):**
Your risk management documentation notes that following Q2 volatility, the firm implemented stricter internal limits:
- Single-issuer concentration reduced from 5% to 3% of inventory
- Dynamic VaR-based limits now in effect
- Sector exposure caps implemented for high-yield

**Exception Handling:**
Contact the margin desk for securities not covered by standard requirements or for negotiated institutional margin agreements.`,
    sources: [
      {
        document_id: 'doc-finra-4210',
        title: 'FINRA Rule 4210: Margin Requirements',
        url: '/documents/doc-finra-4210',
        excerpt: 'Rule 4210 establishes minimum margin requirements for securities transactions...',
        relevance_score: 0.96,
        source_system: 'FINRA Rulebook',
        mime_type: 'application/pdf'
      },
      {
        document_id: 'doc-risk-policy',
        title: 'Risk Management Policy - Position Limits (Updated Q3 2024)',
        url: '/documents/doc-risk-policy',
        excerpt: 'Following the Q2 2024 risk event, enhanced position limits and VaR monitoring...',
        relevance_score: 0.89,
        source_system: 'Internal Policies',
        mime_type: 'application/pdf'
      }
    ],
    response_time_ms: 982,
    confidence: 0.93,
    metadata: {
      model_used: 'llama3.2',
      tokens_used: 723,
      ollama_available: true
    },
    follow_up_questions: [
      'What is our current VaR limit for the corporate bond desk?',
      'How do we calculate margin for structured products?',
      'What are the margin requirements for Treasury securities?'
    ]
  },
  'esg': {
    query_id: 'demo-query-esg',
    answer: `Based on your knowledge base, here's information about ESG bond criteria:

**ESG Bond Classification Framework**

**Green Bonds:**
Must meet ICMA Green Bond Principles:
- Use of Proceeds: 100% allocated to eligible green projects
- Process for Project Evaluation: Documented selection criteria
- Management of Proceeds: Tracked in sub-account or portfolio
- Reporting: Annual allocation and impact reporting

**Social Bonds:**
Per ICMA Social Bond Principles, eligible categories include:
- Affordable housing
- Employment generation (including SME financing)
- Food security and sustainable food systems
- Socioeconomic advancement

**Sustainability-Linked Bonds:**
- Performance tied to predefined Sustainability Performance Targets (SPTs)
- Financial characteristics (coupon step-up) linked to achieving targets
- Annual verification by external reviewer required

**Client Suitability:**
7 of your existing clients have expressed interest in ESG fixed income solutions. The client database flags accounts with ESG mandates requiring:
- Minimum 50% portfolio allocation to ESG-labeled securities
- Annual impact reporting
- Third-party ESG ratings above BB

*Note: Your knowledge base shows a gap in documentation for green bond verification processes. Consider adding internal procedures.*`,
    sources: [
      {
        document_id: 'doc-icma-gbp',
        title: 'ICMA Green Bond Principles 2024',
        url: '/documents/doc-icma-gbp',
        excerpt: 'The Green Bond Principles are voluntary process guidelines that recommend transparency...',
        relevance_score: 0.94,
        source_system: 'External Standards',
        mime_type: 'application/pdf'
      },
      {
        document_id: 'doc-client-esg-mandates',
        title: 'Client ESG Mandate Summary',
        url: '/documents/doc-client-esg-mandates',
        excerpt: 'Summary of client accounts with ESG investment policy requirements...',
        relevance_score: 0.87,
        source_system: 'CRM Export',
        mime_type: 'application/xlsx'
      },
      {
        document_id: 'doc-esg-advisory-plan',
        title: 'ESG Advisory Practice Launch Plan',
        url: '/documents/doc-esg-advisory-plan',
        excerpt: 'Establishing dedicated ESG fixed income advisory team to capitalize on growing demand...',
        relevance_score: 0.82,
        source_system: 'Internal Docs',
        mime_type: 'application/pdf'
      }
    ],
    response_time_ms: 1456,
    confidence: 0.88,
    metadata: {
      model_used: 'llama3.2',
      tokens_used: 912,
      ollama_available: true
    },
    follow_up_questions: [
      'Which clients have ESG mandates requiring annual reporting?',
      'What third-party ESG rating providers do we use?',
      'How do we verify green bond use of proceeds?'
    ]
  }
};

// Business consulting demo responses (Huron-style)
const CONSULTING_RESPONSES: IndustryResponses = {
  'default': {
    query_id: 'demo-consulting-1',
    answer: `Based on your knowledge base, here's the guidance on Fortune 500 engagement protocols:

**Client Engagement Framework**

Our Fortune 500 engagement protocols follow a structured approach designed to maximize value delivery and ensure consistent client experience.

**Pre-Engagement Phase:**
1. **Executive Sponsorship** - Secure C-suite sponsor within first 2 weeks
2. **Stakeholder Mapping** - Document all key decision-makers and influencers
3. **Scope Definition** - Detailed SOW with measurable outcomes and success criteria

**Engagement Governance:**
- Weekly steering committee meetings with executive sponsor
- Bi-weekly progress reports using standardized templates
- Monthly executive dashboards for board visibility
- Quarterly business reviews for long-term engagements

**Risk Management:**
Per our 2024 updated protocols:
- Mandatory risk assessment at project kickoff
- Escalation pathways clearly defined in engagement charter
- Change control process for scope modifications >10% of budget

**Quality Assurance:**
All Fortune 500 deliverables require Partner review before client submission. Use the QA checklist in the Delivery Excellence portal.`,
    sources: [
      {
        document_id: 'doc-engagement-protocols',
        title: 'Fortune 500 Engagement Protocols - 2024 Edition',
        url: '/documents/doc-engagement-protocols',
        excerpt: 'This guide outlines the standard protocols for engaging with Fortune 500 clients...',
        relevance_score: 0.96,
        source_system: 'Delivery Excellence Portal',
        mime_type: 'application/pdf'
      },
      {
        document_id: 'doc-governance-framework',
        title: 'Client Governance Framework',
        url: '/documents/doc-governance-framework',
        excerpt: 'Governance structures ensure consistent delivery quality and risk management...',
        relevance_score: 0.92,
        source_system: 'Methodology Library',
        mime_type: 'application/pdf'
      },
      {
        document_id: 'doc-qa-checklist',
        title: 'Partner Review QA Checklist',
        url: '/documents/doc-qa-checklist',
        excerpt: 'All client-facing deliverables must pass Partner review using this checklist...',
        relevance_score: 0.88,
        source_system: 'Quality Assurance',
        mime_type: 'application/pdf'
      }
    ],
    response_time_ms: 1134,
    confidence: 0.94,
    metadata: {
      model_used: 'llama3.2',
      tokens_used: 856,
      ollama_available: true
    },
    follow_up_questions: [
      'What are the escalation procedures for at-risk engagements?',
      'How do we handle scope changes mid-engagement?',
      'What templates should we use for executive dashboards?'
    ]
  },
  'methodology': {
    query_id: 'demo-consulting-methodology',
    answer: `Based on your knowledge base, here are our digital transformation methodologies:

**Digital Transformation Framework**

Our approach combines industry best practices with proprietary accelerators developed from 200+ successful transformations.

**Phase 1: Discovery & Assessment (Weeks 1-4)**
- Current state analysis using our Digital Maturity Model
- Stakeholder interviews with structured interview guides
- Technology landscape mapping
- Quick wins identification workshop

**Phase 2: Strategy & Roadmap (Weeks 5-8)**
- Vision alignment workshops with C-suite
- Capability gap analysis against target state
- Business case development with ROI modeling
- 18-month transformation roadmap with quarterly milestones

**Phase 3: Design & Blueprint (Weeks 9-16)**
- Operating model design
- Process redesign using Lean Six Sigma principles
- Technology architecture blueprint
- Change management and communication plan

**Phase 4: Implementation & Adoption (Ongoing)**
- Agile delivery with 2-week sprints
- Adoption metrics tracking dashboard
- Continuous improvement cycles

**Proprietary Tools:**
- Digital Maturity Assessment (DMA) - online self-service available
- Transformation ROI Calculator
- Change Readiness Survey

*Note: For regulated industries (healthcare, financial services), additional compliance checkpoints are required per our industry playbooks.*`,
    sources: [
      {
        document_id: 'doc-dt-methodology',
        title: 'Digital Transformation Methodology Guide',
        url: '/documents/doc-dt-methodology',
        excerpt: 'This comprehensive guide outlines our proven approach to digital transformation...',
        relevance_score: 0.97,
        source_system: 'Methodology Library',
        mime_type: 'application/pdf'
      },
      {
        document_id: 'doc-dma-tool',
        title: 'Digital Maturity Assessment - User Guide',
        url: '/documents/doc-dma-tool',
        excerpt: 'The Digital Maturity Assessment evaluates organizations across 6 dimensions...',
        relevance_score: 0.91,
        source_system: 'Tools & Accelerators',
        mime_type: 'application/pdf'
      },
      {
        document_id: 'doc-healthcare-playbook',
        title: 'Healthcare Industry Transformation Playbook',
        url: '/documents/doc-healthcare-playbook',
        excerpt: 'Healthcare-specific considerations including HIPAA compliance checkpoints...',
        relevance_score: 0.85,
        source_system: 'Industry Playbooks',
        mime_type: 'application/pdf'
      }
    ],
    response_time_ms: 1289,
    confidence: 0.93,
    metadata: {
      model_used: 'llama3.2',
      tokens_used: 923,
      ollama_available: true
    },
    follow_up_questions: [
      'How do we customize the methodology for healthcare clients?',
      'What accelerators are available for financial services?',
      'How do we measure transformation success?'
    ]
  },
  'billing': {
    query_id: 'demo-consulting-billing',
    answer: `Based on your knowledge base, here are the current billing rate guidelines:

**2024 Billing Rate Structure**

**Senior Leadership:**
| Level | Standard Rate | Premium Rate* |
|-------|--------------|---------------|
| Managing Director | $850-950/hr | $1,100-1,250/hr |
| Senior Director | $650-750/hr | $850-950/hr |
| Director | $525-625/hr | $700-800/hr |

**Consulting Staff:**
| Level | Standard Rate | Premium Rate* |
|-------|--------------|---------------|
| Senior Manager | $425-500/hr | $550-650/hr |
| Manager | $350-425/hr | $450-525/hr |
| Senior Consultant | $275-325/hr | $350-425/hr |
| Consultant | $200-250/hr | $275-325/hr |
| Analyst | $150-200/hr | $200-250/hr |

*Premium rates apply to specialized practices: Cybersecurity, M&A Integration, AI/ML Implementation

**Rate Approval Authority:**
- Standard rates: Engagement Manager approval
- Discounts up to 10%: Director approval
- Discounts 10-20%: Senior Director approval
- Discounts >20%: Managing Director approval required

**Fixed Fee Engagements:**
For fixed-fee proposals, use the Rate Calculator in Salesforce to ensure minimum 35% margin after all costs.

**Special Considerations:**
- Non-profit discount: Up to 25% (requires MD approval)
- Long-term engagement discount (12+ months): Up to 15%
- Strategic account pricing: Per account plan guidelines`,
    sources: [
      {
        document_id: 'doc-rate-card-2024',
        title: '2024 Global Rate Card - Consulting Services',
        url: '/documents/doc-rate-card-2024',
        excerpt: 'This document establishes standard billing rates effective January 1, 2024...',
        relevance_score: 0.98,
        source_system: 'Finance & Operations',
        mime_type: 'application/pdf'
      },
      {
        document_id: 'doc-discount-policy',
        title: 'Discount Approval Policy',
        url: '/documents/doc-discount-policy',
        excerpt: 'All discounts from standard rates require appropriate level approval...',
        relevance_score: 0.89,
        source_system: 'Finance & Operations',
        mime_type: 'application/pdf'
      }
    ],
    response_time_ms: 876,
    confidence: 0.96,
    metadata: {
      model_used: 'llama3.2',
      tokens_used: 712,
      ollama_available: true
    },
    follow_up_questions: [
      'What is the process for requesting rate exceptions?',
      'How do we handle rate increases for existing clients?',
      'What are the guidelines for blended rate proposals?'
    ]
  },
  'change': {
    query_id: 'demo-consulting-change',
    answer: `Based on your knowledge base, here's our change management approach for restructuring:

**Change Management in Restructuring Engagements**

Restructuring engagements require specialized change management due to heightened organizational anxiety and potential workforce impacts.

**Pre-Announcement Phase:**
- Confidential stakeholder mapping
- Leadership alignment sessions
- Communication cascade planning
- Day-1 readiness checklist

**Announcement & Transition:**
1. **Day-1 Protocol**
   - Coordinated announcement across all locations
   - Manager talking points distributed 24 hours prior
   - HR support stations established
   - FAQ documents prepared for all scenarios

2. **First 30 Days**
   - Daily leadership check-ins
   - Employee listening sessions (anonymous feedback)
   - Rumor tracking and rapid response
   - Retention risk assessment for critical talent

**Sustained Change Support:**
- Monthly pulse surveys
- Change champion network activation
- Skills gap analysis for role transitions
- Outplacement support coordination

**Critical Success Factors:**
Per our 2023 Restructuring Effectiveness Study:
- Organizations with structured change management are 3.5x more likely to achieve restructuring objectives
- Employee productivity impact is 40% lower with proper communication
- Voluntary attrition of retained employees reduced by 60%

**Resources:**
- Restructuring Communication Templates (SharePoint)
- Manager Guide to Difficult Conversations
- Employee Transition Toolkit`,
    sources: [
      {
        document_id: 'doc-restructuring-change',
        title: 'Change Management for Restructuring - Playbook',
        url: '/documents/doc-restructuring-change',
        excerpt: 'This playbook provides structured guidance for managing change during restructuring...',
        relevance_score: 0.95,
        source_system: 'Methodology Library',
        mime_type: 'application/pdf'
      },
      {
        document_id: 'doc-restructuring-study',
        title: '2023 Restructuring Effectiveness Study',
        url: '/documents/doc-restructuring-study',
        excerpt: 'Analysis of 150 restructuring engagements reveals key success factors...',
        relevance_score: 0.91,
        source_system: 'Research & Insights',
        mime_type: 'application/pdf'
      },
      {
        document_id: 'doc-comms-templates',
        title: 'Restructuring Communication Templates',
        url: '/documents/doc-comms-templates',
        excerpt: 'Pre-approved communication templates for various restructuring scenarios...',
        relevance_score: 0.87,
        source_system: 'Templates Library',
        mime_type: 'application/docx'
      }
    ],
    response_time_ms: 1345,
    confidence: 0.92,
    metadata: {
      model_used: 'llama3.2',
      tokens_used: 945,
      ollama_available: true
    },
    follow_up_questions: [
      'What are the legal considerations for workforce reduction communications?',
      'How do we support managers through difficult conversations?',
      'What metrics should we track during a restructuring?'
    ]
  },
  'efficiency': {
    query_id: 'demo-consulting-efficiency',
    answer: `Based on your knowledge base, here are our operational efficiency assessment frameworks:

**Operational Efficiency Assessment Framework**

Our approach combines quantitative analysis with qualitative insights to identify improvement opportunities with measurable ROI.

**Assessment Dimensions:**

**1. Process Efficiency**
- Process mapping using SIPOC and value stream analysis
- Cycle time measurement at each process step
- Defect/rework rate analysis
- Automation opportunity scoring

**2. Resource Utilization**
- FTE analysis by function and activity
- Capacity utilization benchmarking
- Skills inventory vs. requirements gap
- Span of control assessment

**3. Technology Effectiveness**
- System utilization rates
- Integration efficiency (manual handoffs)
- Data quality scoring
- Technology total cost of ownership

**4. Organizational Design**
- Layers and spans analysis
- Decision rights clarity assessment
- Role overlap identification
- Outsourcing/insourcing evaluation

**Benchmarking:**
We leverage our proprietary benchmark database of 500+ organizations across industries:
- Median cost per transaction by function
- Industry-specific productivity ratios
- Best-in-class performance thresholds

**Deliverables:**
1. Current state assessment report with heat map
2. Opportunity catalog with sizing (effort vs. impact matrix)
3. Business case for top 10 initiatives
4. Implementation roadmap with quick wins

**Typical Findings:**
Based on our experience, clients typically identify:
- 15-25% cost reduction opportunity
- 30-40% cycle time improvement potential
- 20-30% automation candidates`,
    sources: [
      {
        document_id: 'doc-ops-framework',
        title: 'Operational Efficiency Assessment Framework',
        url: '/documents/doc-ops-framework',
        excerpt: 'This framework provides a structured approach to assessing operational efficiency...',
        relevance_score: 0.96,
        source_system: 'Methodology Library',
        mime_type: 'application/pdf'
      },
      {
        document_id: 'doc-benchmark-db',
        title: 'Global Benchmarking Database - User Guide',
        url: '/documents/doc-benchmark-db',
        excerpt: 'The benchmarking database contains performance metrics from 500+ organizations...',
        relevance_score: 0.90,
        source_system: 'Tools & Accelerators',
        mime_type: 'application/pdf'
      },
      {
        document_id: 'doc-lean-toolkit',
        title: 'Lean Six Sigma Toolkit for Consulting',
        url: '/documents/doc-lean-toolkit',
        excerpt: 'Practical tools and templates for applying Lean Six Sigma in client engagements...',
        relevance_score: 0.86,
        source_system: 'Methodology Library',
        mime_type: 'application/pdf'
      }
    ],
    response_time_ms: 1178,
    confidence: 0.94,
    metadata: {
      model_used: 'llama3.2',
      tokens_used: 889,
      ollama_available: true
    },
    follow_up_questions: [
      'How do we access the benchmarking database?',
      'What tools do we use for process mapping?',
      'How do we calculate ROI for automation initiatives?'
    ]
  }
};

// Map of all industry demo responses
const INDUSTRY_DEMO_RESPONSES: Record<string, IndustryResponses> = {
  bonds: BONDS_RESPONSES,
  consulting: CONSULTING_RESPONSES,
};

// Get demo response based on query content and industry
function getDemoResponse(query: string, industry?: string | null): QueryResponse {
  const lowerQuery = query.toLowerCase();

  // If industry specified, use industry-specific responses
  if (industry && INDUSTRY_DEMO_RESPONSES[industry]) {
    const industryResponses = INDUSTRY_DEMO_RESPONSES[industry];

    if (industry === 'bonds') {
      if (lowerQuery.includes('margin') || lowerQuery.includes('requirement') || lowerQuery.includes('finra 4210')) {
        return industryResponses['margin'];
      }
      if (lowerQuery.includes('esg') || lowerQuery.includes('green bond') || lowerQuery.includes('sustainable')) {
        return industryResponses['esg'];
      }
    }

    if (industry === 'consulting') {
      if (lowerQuery.includes('methodology') || lowerQuery.includes('digital transformation') || lowerQuery.includes('framework')) {
        return industryResponses['methodology'];
      }
      if (lowerQuery.includes('billing') || lowerQuery.includes('rate') || lowerQuery.includes('pricing')) {
        return industryResponses['billing'];
      }
      if (lowerQuery.includes('change') || lowerQuery.includes('restructuring') || lowerQuery.includes('workforce')) {
        return industryResponses['change'];
      }
      if (lowerQuery.includes('efficiency') || lowerQuery.includes('operational') || lowerQuery.includes('assessment')) {
        return industryResponses['efficiency'];
      }
    }

    return industryResponses['default'];
  }

  // Fallback to bonds responses for backward compatibility
  if (lowerQuery.includes('margin') || lowerQuery.includes('requirement') || lowerQuery.includes('finra 4210')) {
    return BONDS_RESPONSES['margin'];
  }
  if (lowerQuery.includes('esg') || lowerQuery.includes('green bond') || lowerQuery.includes('sustainable')) {
    return BONDS_RESPONSES['esg'];
  }
  return BONDS_RESPONSES['default'];
}

// Get demo response based on query content (backward compatible - uses bonds by default)
function getDemoResponseLegacy(query: string): QueryResponse {
  return getDemoResponse(query, 'bonds');
}

export function useQuery() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<QueryResponse | null>(null);

  const submitQuery = async (request: QueryRequest): Promise<QueryResponse> => {
    setIsLoading(true);
    setError(null);

    // Authentication is handled via httpOnly cookies sent automatically
    // with credentials: 'include' - no need for manual token management

    try {
      const res = await fetch(`${API_URL}/api/query/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          query: request.query,
          max_sources: 5,
          use_llm: true,
          filters: request.filters,
          research_mode: request.research_mode
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        // Provide specific error messages based on status code
        if (res.status === 401) {
          throw new Error('Session expired. Please log in again.');
        }
        if (res.status === 429) {
          throw new Error('Too many requests. Please wait a moment and try again.');
        }
        if (res.status >= 500) {
          throw new Error('Server error. Please try again later.');
        }
        throw new Error(errorData.detail || `Query failed: ${res.status}`);
      }

      const data = await res.json();

      // Transform backend response to frontend format
      const queryResponse: QueryResponse = {
        query_id: `query-${Date.now()}`,
        answer: data.answer,
        sources: data.sources.map((s: any) => ({
          document_id: s.document_id,
          title: s.title,
          url: `/documents/${s.document_id}`,
          excerpt: s.excerpt,
          relevance_score: s.relevance_score,
          source_system: s.source_system,
          source_url: s.source_url,
          mime_type: s.mime_type
        })),
        response_time_ms: data.metrics?.total_time_ms || 0,
        confidence: data.sources.length > 0
          ? data.sources.reduce((acc: number, s: any) => acc + s.relevance_score, 0) / data.sources.length
          : 0,
        metadata: {
          model_used: data.synthesis_method,
          tokens_used: data.metrics?.ollama_tokens || 0,
          ollama_available: data.metrics?.ollama_available || false
        },
        follow_up_questions: data.follow_up_questions || []
      };

      setResponse(queryResponse);
      return queryResponse;
    } catch (err) {
      // Return demo data when API is unavailable
      console.log('Query API unavailable, using demo data');
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate processing time
      const demoResponse = getDemoResponse(request.query, null);
      setResponse(demoResponse);
      return demoResponse;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    submitQuery,
    isLoading,
    error,
    response,
    clearResponse: () => setResponse(null)
  };
}

export function useQueryHistory() {
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);

  const fetchHistory = async () => {
    setIsLoading(true);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Mock history data
    const mockHistory: QueryHistoryItem[] = [
      {
        query_id: 'query-003',
        query_text: 'How do I implement a vector database?',
        created_at: new Date(Date.now() - 3600000).toISOString(),
        sources_cited: 4,
        confidence: 0.92
      },
      {
        query_id: 'query-002',
        query_text: 'What are best practices for RAG systems?',
        created_at: new Date(Date.now() - 7200000).toISOString(),
        sources_cited: 3,
        confidence: 0.88
      },
      {
        query_id: 'query-001',
        query_text: 'Explain semantic search',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        sources_cited: 2,
        confidence: 0.85
      }
    ];

    setHistory(mockHistory);
    setIsLoading(false);
  };

  return {
    history,
    isLoading,
    fetchHistory
  };
}

/**
 * useQueryWithDemo - Hook for demo mode with industry-specific responses
 * When demoIndustry is provided, bypasses API and returns demo data
 */
export function useQueryWithDemo(demoIndustry?: string | null) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<QueryResponse | null>(null);

  const submitQuery = async (request: QueryRequest): Promise<QueryResponse> => {
    setIsLoading(true);
    setError(null);

    // If demo mode is active, skip API and return demo data
    if (demoIndustry) {
      console.log(`Demo mode active for industry: ${demoIndustry}`);
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate processing time
      const demoResponse = getDemoResponse(request.query, demoIndustry);
      setResponse(demoResponse);
      setIsLoading(false);
      return demoResponse;
    }

    // Normal API flow
    try {
      const res = await fetch(`${API_URL}/api/query/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          query: request.query,
          max_sources: 5,
          use_llm: true,
          filters: request.filters,
          research_mode: request.research_mode
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 401) {
          throw new Error('Session expired. Please log in again.');
        }
        if (res.status === 429) {
          throw new Error('Too many requests. Please wait a moment and try again.');
        }
        if (res.status >= 500) {
          throw new Error('Server error. Please try again later.');
        }
        throw new Error(errorData.detail || `Query failed: ${res.status}`);
      }

      const data = await res.json();

      const queryResponse: QueryResponse = {
        query_id: `query-${Date.now()}`,
        answer: data.answer,
        sources: data.sources.map((s: any) => ({
          document_id: s.document_id,
          title: s.title,
          url: `/documents/${s.document_id}`,
          excerpt: s.excerpt,
          relevance_score: s.relevance_score,
          source_system: s.source_system,
          source_url: s.source_url,
          mime_type: s.mime_type
        })),
        response_time_ms: data.metrics?.total_time_ms || 0,
        confidence: data.sources.length > 0
          ? data.sources.reduce((acc: number, s: any) => acc + s.relevance_score, 0) / data.sources.length
          : 0,
        metadata: {
          model_used: data.synthesis_method,
          tokens_used: data.metrics?.ollama_tokens || 0,
          ollama_available: data.metrics?.ollama_available || false
        },
        follow_up_questions: data.follow_up_questions || []
      };

      setResponse(queryResponse);
      return queryResponse;
    } catch (err) {
      // Return demo data when API is unavailable
      console.log('Query API unavailable, using demo data');
      await new Promise(resolve => setTimeout(resolve, 1500));
      const demoResponse = getDemoResponse(request.query, null);
      setResponse(demoResponse);
      return demoResponse;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    submitQuery,
    isLoading,
    error,
    response,
    clearResponse: () => setResponse(null)
  };
}
