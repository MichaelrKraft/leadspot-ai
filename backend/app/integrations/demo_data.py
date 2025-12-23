"""
Demo Data Generator

Generates realistic sample documents for demo mode.
This allows the platform to be demonstrated without real API credentials.
"""

import random
from datetime import datetime, timedelta

from app.integrations.base import SyncedDocument


def _days_ago(days: int) -> datetime:
    """Helper to get datetime N days ago"""
    return datetime.utcnow() - timedelta(days=days)


def _hours_ago(hours: int) -> datetime:
    """Helper to get datetime N hours ago"""
    return datetime.utcnow() - timedelta(hours=hours)


# =============================================================================
# Google Drive Demo Documents
# =============================================================================

GOOGLE_DRIVE_DEMO_DOCS: list[SyncedDocument] = [
    SyncedDocument(
        source_id="gdrive-demo-001",
        title="Q4 2024 Strategic Planning",
        content="""
Q4 2024 Strategic Planning Document

Executive Summary
-----------------
This document outlines our strategic priorities for Q4 2024, focusing on three key areas:
market expansion, product development, and operational efficiency.

Key Initiatives:

1. Market Expansion
   - Launch in 3 new geographic markets (UK, Germany, Australia)
   - Target 40% increase in enterprise customer base
   - Establish partnerships with 5 key system integrators

2. Product Development
   - Release v3.0 of core platform with AI-powered insights
   - Implement real-time collaboration features
   - Enhance mobile experience for field teams

3. Operational Efficiency
   - Reduce customer onboarding time by 50%
   - Implement automated billing and invoicing
   - Achieve SOC 2 Type II certification

Budget Allocation:
- Engineering: $2.4M
- Sales & Marketing: $1.8M
- Operations: $800K

Success Metrics:
- ARR growth: 35% QoQ
- Customer satisfaction (NPS): 65+
- Employee retention: 92%+

Timeline and Milestones:
- October: Market research completion, v3.0 beta release
- November: UK launch, partnership announcements
- December: Germany/Australia soft launch, year-end review
        """,
        mime_type="application/vnd.google-apps.document",
        file_size=4500,
        source_url="https://docs.google.com/document/d/demo-q4-strategy",
        author="Sarah Chen",
        created_at=_days_ago(45),
        modified_at=_days_ago(3),
        metadata={"folder": "Strategy", "shared_with": ["leadership", "all-hands"]}
    ),
    SyncedDocument(
        source_id="gdrive-demo-002",
        title="Product Roadmap 2024-2025",
        content="""
Product Roadmap 2024-2025

Vision Statement
----------------
Become the leading knowledge synthesis platform for enterprise teams,
enabling seamless information discovery across all organizational data sources.

Q4 2024 Releases:
-----------------
v3.0 - "Atlas"
- AI-powered search with natural language queries
- Integration with Google Drive, Slack, and Microsoft 365
- Advanced permission management
- Real-time collaboration on queries

v3.1 - "Beacon" (December)
- Custom AI training on company data
- Automated knowledge graph generation
- Mobile app for iOS and Android
- SSO with SAML 2.0

Q1 2025 Planned:
----------------
v3.2 - "Compass"
- Video and audio content indexing
- Multi-language support (10 languages)
- API for custom integrations
- White-label option for partners

Q2 2025 Planned:
----------------
v4.0 - "Discovery"
- Proactive insights and recommendations
- Automated compliance monitoring
- Industry-specific templates
- Enterprise analytics dashboard

Technical Debt:
- Migrate to microservices architecture
- Implement comprehensive monitoring
- Database performance optimization
        """,
        mime_type="application/vnd.google-apps.document",
        file_size=3200,
        source_url="https://docs.google.com/document/d/demo-roadmap",
        author="Marcus Williams",
        created_at=_days_ago(90),
        modified_at=_days_ago(7),
        metadata={"folder": "Product", "shared_with": ["product-team", "engineering"]}
    ),
    SyncedDocument(
        source_id="gdrive-demo-003",
        title="Employee Onboarding Guide",
        content="""
Employee Onboarding Guide

Welcome to InnoSynth!

Week 1: Getting Started
-----------------------
Day 1:
- Complete HR paperwork and benefits enrollment
- Set up laptop, email, and Slack accounts
- Meet with your manager for team overview
- Attend Welcome Orientation at 2pm

Day 2-3:
- Complete security awareness training
- Set up development environment (Engineering) or sales tools (Sales)
- Shadow a team member
- Review company handbook and policies

Day 4-5:
- Begin role-specific training modules
- Meet cross-functional team members
- Attend team standup meetings
- Set 30-day goals with manager

Week 2: Deep Dive
-----------------
- Complete product training certification
- Begin first project with mentor support
- Attend department all-hands meeting
- Schedule 1:1s with key stakeholders

Week 3-4: Integration
---------------------
- Take ownership of first task/project
- Present learnings at team meeting
- Complete compliance training modules
- Participate in company social events

Key Resources:
- IT Help Desk: #it-support in Slack
- HR Questions: hr@company.com
- Manager: Your direct supervisor
- Buddy Program: Ask HR for your assigned buddy

Benefits Overview:
- Health, dental, vision insurance (starts Day 1)
- 401(k) with 4% company match (after 90 days)
- Unlimited PTO (minimum 15 days encouraged)
- $1,500 annual learning budget
- Remote work flexibility
        """,
        mime_type="application/vnd.google-apps.document",
        file_size=2800,
        source_url="https://docs.google.com/document/d/demo-onboarding",
        author="HR Team",
        created_at=_days_ago(180),
        modified_at=_days_ago(14),
        metadata={"folder": "HR", "shared_with": ["all-employees"]}
    ),
    SyncedDocument(
        source_id="gdrive-demo-004",
        title="Engineering Best Practices",
        content="""
Engineering Best Practices Guide

Code Standards
--------------
1. All code must be reviewed by at least one other engineer
2. Write unit tests for all new functionality (target 80% coverage)
3. Use meaningful commit messages following conventional commits
4. Document all public APIs and complex logic

Git Workflow:
- Main branch is always deployable
- Feature branches: feature/TICKET-description
- Bug fixes: fix/TICKET-description
- Create PR early, mark as draft if WIP
- Squash commits on merge

Code Review Guidelines:
- Review within 24 hours of PR creation
- Focus on logic, not style (use linters for that)
- Ask questions rather than make demands
- Approve only when confident in the code

Deployment Process:
1. Merge to main triggers CI/CD pipeline
2. Automated tests must pass
3. Staging deployment for QA verification
4. Production deployment with feature flags
5. Monitor metrics for 30 minutes post-deploy

On-Call Responsibilities:
- Respond to pages within 15 minutes
- Document all incidents in #incidents channel
- Write post-mortems for any production issues
- Hand off cleanly to next on-call engineer

Architecture Decisions:
- Major changes require RFC document
- Present at Architecture Review meeting
- Document decisions in ADR format
- Consider backward compatibility
        """,
        mime_type="application/vnd.google-apps.document",
        file_size=2100,
        source_url="https://docs.google.com/document/d/demo-eng-practices",
        author="Engineering Team",
        created_at=_days_ago(120),
        modified_at=_days_ago(21),
        metadata={"folder": "Engineering", "shared_with": ["engineering"]}
    ),
    SyncedDocument(
        source_id="gdrive-demo-005",
        title="Sales Playbook - Enterprise Deals",
        content="""
Enterprise Sales Playbook

Target Customer Profile
-----------------------
- Company size: 500+ employees
- Annual revenue: $50M+
- Industries: Technology, Financial Services, Healthcare, Manufacturing
- Pain points: Information silos, slow decision-making, compliance challenges

Sales Process Overview:

Stage 1: Discovery (Week 1-2)
- Initial outreach via warm intro or targeted campaign
- Discovery call to understand challenges
- Qualify using BANT framework
- Identify key stakeholders and decision-makers

Stage 2: Solution Presentation (Week 3-4)
- Customize demo for their specific use cases
- Present ROI calculator and case studies
- Address technical requirements with SE support
- Proposal with pricing options

Stage 3: Evaluation (Week 5-8)
- Pilot program setup (30-day trial)
- Weekly check-ins during pilot
- Gather user feedback and success metrics
- Security review and compliance documentation

Stage 4: Negotiation (Week 9-10)
- Final pricing discussion
- Contract review with legal
- Procurement process navigation
- Executive sponsor alignment

Stage 5: Close (Week 11-12)
- Contract signing
- Implementation kickoff
- Customer success handoff
- Reference commitment

Pricing Guidelines:
- Enterprise: $15/user/month (annual contract)
- Volume discounts: 10% at 500+ users, 20% at 1000+ users
- Multi-year discount: 10% for 2-year, 15% for 3-year
- Never discount more than 30% without VP approval

Competitive Positioning:
- vs. Guru: More powerful AI, better integrations
- vs. Notion: Enterprise-grade security, advanced search
- vs. Confluence: Modern UX, AI capabilities
        """,
        mime_type="application/vnd.google-apps.document",
        file_size=3500,
        source_url="https://docs.google.com/document/d/demo-sales-playbook",
        author="Jennifer Martinez",
        created_at=_days_ago(60),
        modified_at=_days_ago(5),
        metadata={"folder": "Sales", "shared_with": ["sales-team"]}
    ),
    SyncedDocument(
        source_id="gdrive-demo-006",
        title="Q3 2024 Financial Report",
        content="""
Q3 2024 Financial Report

Revenue Summary
---------------
Total Revenue: $4.2M (up 28% YoY)
- Subscription Revenue: $3.8M
- Professional Services: $400K

Monthly Recurring Revenue (MRR): $1.4M
Annual Recurring Revenue (ARR): $16.8M

Customer Metrics:
- Total Customers: 342 (up from 285 in Q2)
- Enterprise Customers: 48 (up from 39 in Q2)
- Average Contract Value: $49K (enterprise)
- Net Revenue Retention: 118%
- Gross Revenue Churn: 3.2%

Expense Breakdown:
- Salaries & Benefits: $2.1M
- Cloud Infrastructure: $380K
- Marketing: $520K
- Sales Commissions: $280K
- G&A: $340K
- Total Expenses: $3.62M

Profitability:
- Gross Margin: 78%
- Operating Margin: 14%
- EBITDA: $580K

Cash Position:
- Cash on Hand: $8.2M
- Burn Rate: $180K/month
- Runway: 45+ months

Key Highlights:
- Closed largest deal ever: $420K ACV with Fortune 500 company
- Launched in European market with 12 new customers
- Achieved SOC 2 Type I certification
- Hired 15 new team members, now at 78 total employees

Challenges:
- Sales cycle lengthening in enterprise segment
- Increased competition requiring more marketing spend
- Infrastructure costs growing faster than expected
        """,
        mime_type="application/vnd.google-apps.spreadsheet",
        file_size=5200,
        source_url="https://docs.google.com/spreadsheets/d/demo-financial-q3",
        author="David Kim",
        created_at=_days_ago(35),
        modified_at=_days_ago(2),
        metadata={"folder": "Finance", "shared_with": ["leadership", "board"]}
    ),
    SyncedDocument(
        source_id="gdrive-demo-007",
        title="Customer Success Metrics Dashboard",
        content="""
Customer Success Metrics - October 2024

Overall Health Score: 82/100 (Good)

Active Users:
- Daily Active Users: 2,847
- Weekly Active Users: 4,123
- Monthly Active Users: 5,891
- DAU/MAU Ratio: 48%

Engagement Metrics:
- Avg queries per user per day: 4.7
- Avg documents uploaded per org: 342
- Avg integrations per org: 2.3
- Feature adoption rate (AI features): 67%

Customer Satisfaction:
- NPS Score: 62
- CSAT (Support): 4.6/5.0
- Time to First Value: 3.2 days
- Onboarding Completion Rate: 89%

Support Metrics:
- Tickets Opened: 234
- Avg Response Time: 2.4 hours
- Avg Resolution Time: 18 hours
- First Contact Resolution: 72%

Churn Risk Analysis:
- High Risk Accounts: 8
- Medium Risk Accounts: 23
- Common risk factors: Low usage, no exec sponsor, budget cuts

Expansion Opportunities:
- Upsell Pipeline: $890K
- Cross-sell Opportunities: 34 accounts
- Referral Program: 12 active referrers

Top Feature Requests:
1. Mobile app (47 requests)
2. Slack integration improvements (38 requests)
3. Custom dashboards (31 requests)
4. API access (28 requests)
5. SSO support (24 requests)
        """,
        mime_type="application/vnd.google-apps.spreadsheet",
        file_size=2900,
        source_url="https://docs.google.com/spreadsheets/d/demo-cs-metrics",
        author="Customer Success Team",
        created_at=_days_ago(10),
        modified_at=_days_ago(1),
        metadata={"folder": "Customer Success", "shared_with": ["cs-team", "leadership"]}
    ),
    SyncedDocument(
        source_id="gdrive-demo-008",
        title="Security Policy and Compliance",
        content="""
Information Security Policy

1. Data Classification
----------------------
- Public: Marketing materials, public documentation
- Internal: Company policies, general communications
- Confidential: Customer data, financial information, employee records
- Restricted: Security credentials, encryption keys, audit logs

2. Access Control
-----------------
- Principle of least privilege applies to all systems
- Access reviews conducted quarterly
- MFA required for all production systems
- Shared accounts are prohibited

3. Data Handling
----------------
- Customer data encrypted at rest (AES-256) and in transit (TLS 1.3)
- No customer data on local machines
- Data retention: Active data indefinitely, deleted data purged after 90 days
- Data export available upon customer request

4. Incident Response
--------------------
Level 1 (Low): Respond within 72 hours
Level 2 (Medium): Respond within 24 hours
Level 3 (High): Respond within 4 hours
Level 4 (Critical): Respond within 1 hour

Incident Response Team:
- Security Lead: security@company.com
- On-call Engineer: Via PagerDuty
- Legal: legal@company.com
- Communications: pr@company.com

5. Compliance
-------------
- SOC 2 Type II: Certified (audit completed Sept 2024)
- GDPR: Compliant with DPA available
- CCPA: Compliant
- HIPAA: BAA available for healthcare customers

6. Vendor Management
--------------------
- All vendors must complete security questionnaire
- Annual review of critical vendors
- Data processing agreements required
- Regular access audits

7. Employee Security
--------------------
- Background checks for all employees
- Security awareness training quarterly
- Phishing simulations monthly
- Clear desk policy enforced
        """,
        mime_type="application/vnd.google-apps.document",
        file_size=3800,
        source_url="https://docs.google.com/document/d/demo-security-policy",
        author="Security Team",
        created_at=_days_ago(200),
        modified_at=_days_ago(30),
        metadata={"folder": "Security", "shared_with": ["all-employees"]}
    ),
]


# =============================================================================
# Slack Demo Messages
# =============================================================================

SLACK_DEMO_MESSAGES: list[SyncedDocument] = [
    SyncedDocument(
        source_id="slack-demo-001",
        title="#product-strategy - Q4 Feature Prioritization Discussion",
        content="""
Channel: #product-strategy
Date: October 15, 2024

Sarah Chen: Hey team, we need to finalize our Q4 feature priorities by EOD Friday. I've drafted a list based on customer feedback and our strategic goals. Let's discuss.

Marcus Williams: I think the AI-powered search should be our top priority. I've had 5 enterprise prospects this month specifically ask about it.

Jennifer Martinez: Agree with Marcus. Our biggest competitor just launched something similar. We need to stay competitive.

David Kim: From a resource perspective, we can probably get AI search done by end of October if we start now. The mobile app would push us into November.

Sarah Chen: Good point David. What about the Slack integration improvements? That's been the #1 feature request for 3 months.

Emily Thompson: The Slack integration is mostly done actually. I think we can ship it in 2 weeks if we prioritize the final testing.

Marcus Williams: That's great news Emily! Let's do: 1) Slack integration (October), 2) AI search (November), 3) Mobile app (December)

Sarah Chen: I like that ordering. Any objections?

Jennifer Martinez: Works for me. I'll update the roadmap doc.

Sarah Chen: Perfect. Let's sync on Monday to kick off Slack integration sprint.

[Thread - 12 replies]
        """,
        mime_type="text/plain",
        file_size=1200,
        source_url="https://slack.com/archives/C1234567/p1234567890",
        author="Multiple",
        created_at=_days_ago(15),
        modified_at=_days_ago(15),
        metadata={"channel": "product-strategy", "thread_count": 12, "participants": 5}
    ),
    SyncedDocument(
        source_id="slack-demo-002",
        title="#engineering - Production Incident Post-Mortem",
        content="""
Channel: #engineering
Date: October 10, 2024

Alex Rivera: :alert: Production incident resolved. Here's the post-mortem:

**Incident Summary**
- Duration: 47 minutes
- Impact: 23% of users experienced slow queries
- Root cause: Database connection pool exhausted

**Timeline**
- 14:32 - Monitoring alert triggered
- 14:35 - On-call engineer (me) acknowledged
- 14:42 - Root cause identified
- 14:58 - Fix deployed (increased pool size)
- 15:19 - All systems nominal

**Root Cause**
A new feature released yesterday had an N+1 query issue that wasn't caught in code review. Under high load, this exhausted our connection pool.

**Action Items**
1. Add query performance tests to CI pipeline (Alex - by Oct 17)
2. Implement connection pool monitoring with alerts (Sam - by Oct 14)
3. Update code review checklist to include query analysis (Team - done)

**Lessons Learned**
We need better tooling to catch these issues before production. Discussed adding a query analyzer to our PR workflow.

Emily Thompson: Thanks for the thorough post-mortem Alex. The N+1 issue was my code - sorry about that. I'll be more careful.

Alex Rivera: No worries Emily, that's why we have these processes. The important thing is we caught it and fixed it quickly.

Sam Jackson: I've already started on the connection pool monitoring. Should have it done by tomorrow.

[Thread - 8 replies]
        """,
        mime_type="text/plain",
        file_size=1500,
        source_url="https://slack.com/archives/C2345678/p2345678901",
        author="Alex Rivera",
        created_at=_days_ago(10),
        modified_at=_days_ago(10),
        metadata={"channel": "engineering", "thread_count": 8, "participants": 4}
    ),
    SyncedDocument(
        source_id="slack-demo-003",
        title="#sales - Enterprise Deal Won - Acme Corp",
        content="""
Channel: #sales
Date: October 18, 2024

Jennifer Martinez: :tada: HUGE WIN! Just signed Acme Corporation - $420K ACV, 3-year deal!

This is our largest deal ever and a Fortune 500 logo!

Key details:
- 2,500 users
- Full platform deployment
- Custom integration with their Salesforce instance
- Executive sponsor: VP of Operations

Thanks to everyone who helped:
- @Marcus Williams for the demo support
- @Emily Thompson for the custom Salesforce integration work
- @Sarah Chen for the executive alignment calls

David Kim: Congratulations Jennifer! This is a game-changer for our enterprise positioning.

Sarah Chen: Amazing work! This validates our enterprise strategy. Let's do a deal review to capture what worked.

Marcus Williams: Well deserved Jen! That Salesforce integration was key - great job Emily!

Emily Thompson: Happy to help! The integration work was fun actually. Looking forward to more like this.

Michael Brown (CEO): Outstanding Jennifer! This is exactly the kind of deal we've been building towards. Celebrating at all-hands on Friday!

Jennifer Martinez: Thanks everyone! Couldn't have done it without this team. Happy to do a deal review next week.

[Thread - 24 replies, 15 emoji reactions]
        """,
        mime_type="text/plain",
        file_size=1100,
        source_url="https://slack.com/archives/C3456789/p3456789012",
        author="Jennifer Martinez",
        created_at=_days_ago(2),
        modified_at=_days_ago(2),
        metadata={"channel": "sales", "thread_count": 24, "participants": 7}
    ),
    SyncedDocument(
        source_id="slack-demo-004",
        title="#customer-success - Churn Risk Alert: TechStart Inc",
        content="""
Channel: #customer-success
Date: October 16, 2024

CS Bot: :warning: Churn Risk Alert

**Account:** TechStart Inc
**Risk Score:** High (78/100)
**Contract Renewal:** December 15, 2024
**ACV:** $36,000

**Risk Factors:**
- Usage down 45% in last 30 days
- No login from executive sponsor in 60 days
- 3 support tickets unresolved
- Champion left company 2 weeks ago

Amanda Foster: Thanks for the alert. I'm reaching out to their new point of contact today.

Quick context: Their VP of Engineering (our champion) left for another company. The new person seems less engaged.

Rachel Torres: I had a similar situation with DataFlow Corp. What worked was getting their CEO involved - showing ROI data helped a lot.

Amanda Foster: Good idea Rachel. I'll pull together an ROI report before the call.

David Kim: Let me know if you need help with the financials Amanda. I can show them their cost savings since implementation.

Amanda Foster: That would be great David! Can you have that ready by Thursday?

David Kim: You got it.

[Update - October 20]
Amanda Foster: Good news! Had a great call with their new VP. They're actually planning to expand usage to their marketing team. Renewal looking solid now.

[Thread - 11 replies]
        """,
        mime_type="text/plain",
        file_size=1300,
        source_url="https://slack.com/archives/C4567890/p4567890123",
        author="CS Bot",
        created_at=_days_ago(4),
        modified_at=_days_ago(0),
        metadata={"channel": "customer-success", "thread_count": 11, "participants": 4}
    ),
    SyncedDocument(
        source_id="slack-demo-005",
        title="#general - Company All-Hands Summary",
        content="""
Channel: #general
Date: October 20, 2024

Michael Brown (CEO): Thanks everyone for joining today's all-hands! Here's a summary for those who couldn't make it:

**Key Announcements:**

1. **Q3 Results** - We hit 118% of our revenue target! ARR now at $16.8M.

2. **New Hires** - Welcome to our 12 new team members this month! We're now 78 strong.

3. **Product Launch** - AI-powered search launching November 1st. Demo at 2pm tomorrow for everyone interested.

4. **Enterprise Win** - Congrats to Jennifer Martinez on closing Acme Corp, our largest deal ever!

5. **Office Update** - SF office expansion complete. New space available starting Monday.

**Q&A Highlights:**
- Q: When is the mobile app launching? A: Target is December, beta in November
- Q: Will there be holiday bonus? A: Yes, details coming in November
- Q: Remote work policy changes? A: No changes planned. Hybrid remains optional.

**Upcoming Events:**
- Oct 25: Halloween party (SF office)
- Nov 1: AI Search launch celebration
- Nov 15: Q4 planning offsite (leadership)
- Dec 13: Holiday party (company-wide)

Recording will be posted in #all-hands-recordings by EOD.

[Thread - 45 replies, 67 emoji reactions]
        """,
        mime_type="text/plain",
        file_size=1400,
        source_url="https://slack.com/archives/C5678901/p5678901234",
        author="Michael Brown",
        created_at=_days_ago(0),
        modified_at=_days_ago(0),
        metadata={"channel": "general", "thread_count": 45, "participants": 32}
    ),
    SyncedDocument(
        source_id="slack-demo-006",
        title="#engineering - Architecture Decision: Microservices Migration",
        content="""
Channel: #engineering
Date: October 8, 2024

Alex Rivera: Team, I've drafted an RFC for our microservices migration. Key points:

**Current State:**
- Monolithic Python application
- Single PostgreSQL database
- Growing performance bottlenecks
- Difficult to scale individual components

**Proposed Architecture:**
- Core services: Auth, Documents, Search, Sync
- Each service owns its data
- Event-driven communication (Kafka)
- Kubernetes for orchestration

**Timeline:**
- Phase 1 (Q1): Extract Auth service
- Phase 2 (Q2): Extract Search service
- Phase 3 (Q3): Extract Documents service
- Phase 4 (Q4): Complete migration, deprecate monolith

**Open Questions:**
1. Do we use gRPC or REST for inter-service communication?
2. How do we handle distributed transactions?
3. What's our testing strategy during migration?

Emily Thompson: I like the phased approach. Starting with Auth makes sense since it's the most isolated.

For question 1, I'd vote REST for simplicity. We can always optimize to gRPC later for hot paths.

Sam Jackson: Agree with Emily on REST. For distributed transactions, I'd suggest the saga pattern with compensation.

Alex Rivera: Good points. Let's schedule a deep-dive meeting this week to finalize.

Full RFC: https://docs.google.com/document/d/microservices-rfc

[Thread - 28 replies]
        """,
        mime_type="text/plain",
        file_size=1600,
        source_url="https://slack.com/archives/C2345678/p6789012345",
        author="Alex Rivera",
        created_at=_days_ago(12),
        modified_at=_days_ago(8),
        metadata={"channel": "engineering", "thread_count": 28, "participants": 8}
    ),
    SyncedDocument(
        source_id="slack-demo-007",
        title="#hiring - Senior Backend Engineer Candidates",
        content="""
Channel: #hiring
Date: October 14, 2024

HR Bot: New candidates for Senior Backend Engineer role:

**Candidate 1: John Park**
- 8 years experience
- Currently at Stripe
- Strong Python, distributed systems
- Interview scheduled: Oct 18

**Candidate 2: Lisa Chen**
- 6 years experience
- Currently at Datadog
- Expertise in observability, Kubernetes
- Interview scheduled: Oct 19

**Candidate 3: Robert Kim**
- 10 years experience
- Currently at Netflix
- Strong in data pipelines, ML systems
- Interview scheduled: Oct 21

Alex Rivera: All three look strong! John's Stripe experience is interesting given our payments integration plans.

Emily Thompson: Lisa's observability background would be perfect for our monitoring improvements.

Sam Jackson: Robert's ML experience could help with our AI features. Excited to meet all of them.

Sarah Chen: Great pipeline! Let's make sure we're prepared with good interview questions. I've updated the interview guide in Notion.

Alex Rivera: Thanks Sarah. I'll be the hiring manager for these interviews. Loop me in on any scheduling issues.

[Thread - 15 replies]
        """,
        mime_type="text/plain",
        file_size=1000,
        source_url="https://slack.com/archives/C6789012/p7890123456",
        author="HR Bot",
        created_at=_days_ago(6),
        modified_at=_days_ago(4),
        metadata={"channel": "hiring", "thread_count": 15, "participants": 5}
    ),
    SyncedDocument(
        source_id="slack-demo-008",
        title="#support - Critical Bug Report: Data Export",
        content="""
Channel: #support
Date: October 17, 2024

Support Bot: :bug: New critical bug report

**Reporter:** Enterprise customer (Acme Corp)
**Priority:** P1
**Feature:** Data Export
**Description:** CSV export timing out for large datasets (>50K records)

Customer quote: "We need to export our data for compliance audit next week. This is blocking our quarterly review."

Amanda Foster: This is our newest enterprise customer. We need to prioritize this.

Alex Rivera: I'll take a look. This sounds like a memory issue with our current export implementation.

[Update - 2 hours later]

Alex Rivera: Found the issue. We're loading all records into memory before writing to CSV. I have a fix that streams the data instead.

PR: https://github.com/company/app/pull/1234

Emily Thompson: Reviewed and approved. Looks good!

Alex Rivera: Deployed to production. @Amanda Foster can you verify with the customer?

[Update - 30 minutes later]

Amanda Foster: Customer confirmed it's working! They were able to export 150K records in under a minute. They're very happy.

Customer quote: "Wow, that was fast! Thanks for the quick turnaround."

Alex Rivera: Great team effort! :tada:

[Thread - 18 replies]
        """,
        mime_type="text/plain",
        file_size=1200,
        source_url="https://slack.com/archives/C7890123/p8901234567",
        author="Support Bot",
        created_at=_days_ago(3),
        modified_at=_days_ago(3),
        metadata={"channel": "support", "thread_count": 18, "participants": 4}
    ),
]


def get_google_drive_demo_docs() -> list[SyncedDocument]:
    """Get all Google Drive demo documents"""
    return GOOGLE_DRIVE_DEMO_DOCS.copy()


def get_slack_demo_messages() -> list[SyncedDocument]:
    """Get all Slack demo messages"""
    return SLACK_DEMO_MESSAGES.copy()


def get_random_demo_subset(
    docs: list[SyncedDocument],
    count: int
) -> list[SyncedDocument]:
    """Get a random subset of demo documents"""
    if count >= len(docs):
        return docs.copy()
    return random.sample(docs, count)
