"""Decision factor analysis using Claude AI."""

import json

from anthropic import AsyncAnthropic

from app.config import settings


class FactorAnalyzer:
    """Analyze factors that influenced decisions using Claude."""

    def __init__(self):
        self.client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    async def analyze_decision_factors(
        self,
        decision_title: str,
        decision_description: str,
        context: dict = None
    ) -> list[dict]:
        """
        Identify and score factors that influenced a decision.

        Args:
            decision_title: Title of the decision
            decision_description: Full description of the decision
            context: Additional context (people, projects, dates)

        Returns:
            List of factors with impact scores and explanations
        """
        context_str = ""
        if context:
            context_str = f"""
Context:
- People involved: {', '.join(context.get('people', []))}
- Related projects: {', '.join(context.get('projects', []))}
- Time period: {', '.join(context.get('dates', []))}
"""

        prompt = f"""Analyze this business decision and identify the key factors that influenced it:

Decision: {decision_title}

Description: {decision_description}

{context_str}

Identify 5-10 key factors that likely influenced this decision. For each factor, provide:
1. **Factor name**: Short descriptive name (e.g., "Market competition", "Budget constraints")
2. **Category**: One of [market, financial, technical, organizational, customer, competitive, regulatory, strategic]
3. **Impact score**: 1-10 (how much this factor influenced the decision)
4. **Explanation**: Why this factor mattered (1-2 sentences)

Return ONLY valid JSON:
{{
  "factors": [
    {{
      "name": "Factor name",
      "category": "market",
      "impact_score": 8,
      "explanation": "Brief explanation of impact"
    }}
  ]
}}
"""

        try:
            response = await self.client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=2500,
                temperature=0.3,
                messages=[{"role": "user", "content": prompt}]
            )

            content = response.content[0].text
            result = json.loads(content)

            # Validate and normalize factors
            factors = result.get("factors", [])
            for factor in factors:
                # Ensure impact_score is between 1-10
                factor["impact_score"] = max(1, min(10, factor.get("impact_score", 5)))
                # Ensure category is valid
                valid_categories = [
                    "market", "financial", "technical", "organizational",
                    "customer", "competitive", "regulatory", "strategic"
                ]
                if factor.get("category") not in valid_categories:
                    factor["category"] = "strategic"

            return factors

        except Exception as e:
            print(f"Factor analysis error: {e}")
            return []

    async def compare_decisions(
        self,
        decision1: dict,
        decision2: dict
    ) -> dict:
        """
        Compare two decisions to identify similarities and differences.

        Args:
            decision1: First decision with title and description
            decision2: Second decision with title and description

        Returns:
            Comparison analysis with similarities, differences, and insights
        """
        prompt = f"""Compare these two business decisions and analyze their relationships:

Decision 1: {decision1['title']}
{decision1.get('description', '')}

Decision 2: {decision2['title']}
{decision2.get('description', '')}

Provide:
1. **Similarities**: What factors or circumstances were similar?
2. **Differences**: Key differences in approach or context
3. **Relationship**: How are these decisions related? (independent, sequential, alternative, complementary)
4. **Insights**: What can be learned from comparing these decisions?

Return as JSON:
{{
  "similarities": ["similarity 1", "similarity 2"],
  "differences": ["difference 1", "difference 2"],
  "relationship": "sequential|alternative|complementary|independent",
  "insights": ["insight 1", "insight 2"]
}}
"""

        try:
            response = await self.client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=2000,
                temperature=0.3,
                messages=[{"role": "user", "content": prompt}]
            )

            content = response.content[0].text
            comparison = json.loads(content)
            return comparison

        except Exception as e:
            print(f"Decision comparison error: {e}")
            return {
                "similarities": [],
                "differences": [],
                "relationship": "independent",
                "insights": []
            }

    async def predict_outcomes(
        self,
        decision_title: str,
        decision_description: str,
        factors: list[dict]
    ) -> dict:
        """
        Predict potential outcomes based on decision factors.

        Args:
            decision_title: Title of the decision
            decision_description: Full description
            factors: List of identified factors

        Returns:
            Predicted outcomes with likelihood and reasoning
        """
        factors_str = "\n".join([
            f"- {f['name']} (impact: {f['impact_score']}/10): {f['explanation']}"
            for f in factors
        ])

        prompt = f"""Based on this decision and its influencing factors, predict potential outcomes:

Decision: {decision_title}
{decision_description}

Key Factors:
{factors_str}

Predict:
1. **Likely outcomes**: 3-5 probable results (with likelihood %)
2. **Risks**: Potential negative consequences
3. **Opportunities**: Potential positive consequences
4. **Time horizon**: When outcomes might materialize

Return as JSON:
{{
  "outcomes": [
    {{
      "description": "outcome description",
      "likelihood": 75,
      "impact": "high|medium|low",
      "timeframe": "short-term|medium-term|long-term"
    }}
  ],
  "risks": ["risk 1", "risk 2"],
  "opportunities": ["opportunity 1", "opportunity 2"]
}}
"""

        try:
            response = await self.client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=2000,
                temperature=0.3,
                messages=[{"role": "user", "content": prompt}]
            )

            content = response.content[0].text
            predictions = json.loads(content)
            return predictions

        except Exception as e:
            print(f"Outcome prediction error: {e}")
            return {
                "outcomes": [],
                "risks": [],
                "opportunities": []
            }

    async def analyze_patterns(
        self,
        decisions: list[dict]
    ) -> dict:
        """
        Analyze patterns across multiple decisions.

        Args:
            decisions: List of decision dicts with title, description, category, created_at

        Returns:
            Patterns, insights, and recommendations
        """
        if not decisions:
            return {
                "patterns": [],
                "insights": ["No decisions found to analyze."],
                "recommendations": ["Start recording decisions to discover patterns."]
            }

        decisions_str = "\n".join([
            f"- [{d.get('category', 'unknown')}] {d['title']}: {d.get('description', '')[:200]}... (Date: {d.get('created_at', 'unknown')})"
            for d in decisions[:50]  # Limit to 50 most recent
        ])

        prompt = f"""Analyze these business decisions and identify patterns, recurring themes, and insights:

Decisions ({len(decisions)} total):
{decisions_str}

Identify:
1. **Patterns**: Recurring themes, decision types, or approaches
2. **Insights**: What can be learned from these decisions collectively?
3. **Recommendations**: Suggestions for future decision-making

Return as JSON:
{{
  "patterns": [
    {{
      "pattern_type": "category|theme|timing|approach",
      "description": "Description of the pattern",
      "frequency": 5,
      "decisions": ["decision title 1", "decision title 2"],
      "timespan": {{"start": "2024-01", "end": "2024-12"}}
    }}
  ],
  "insights": ["insight 1", "insight 2"],
  "recommendations": ["recommendation 1", "recommendation 2"]
}}
"""

        try:
            response = await self.client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=3000,
                temperature=0.3,
                messages=[{"role": "user", "content": prompt}]
            )

            content = response.content[0].text
            result = json.loads(content)
            return result

        except Exception as e:
            print(f"Pattern analysis error: {e}")
            return {
                "patterns": [],
                "insights": ["Unable to analyze patterns at this time."],
                "recommendations": []
            }

    async def generate_insights(
        self,
        decision_title: str,
        decision_description: str,
        factors: list[dict],
        outcomes: list[dict] = None,
        related_decisions: list[dict] = None
    ) -> dict:
        """
        Generate AI insights for a specific decision.

        Args:
            decision_title: Title of the decision
            decision_description: Full description
            factors: List of identified factors
            outcomes: Optional list of outcomes
            related_decisions: Optional list of related decisions

        Returns:
            AI insights with observations, recommendations, risks, opportunities
        """
        factors_str = "\n".join([
            f"- {f['name']} ({f.get('category', 'unknown')}): Impact {f.get('impact_score', 5)}/10 - {f.get('explanation', '')}"
            for f in factors
        ]) if factors else "No factors identified yet."

        outcomes_str = ""
        if outcomes:
            outcomes_str = "\nOutcomes:\n" + "\n".join([
                f"- {o.get('description', 'Unknown')} (Likelihood: {o.get('likelihood', 'unknown')}%)"
                for o in outcomes
            ])

        related_str = ""
        if related_decisions:
            related_str = "\nRelated Decisions:\n" + "\n".join([
                f"- {r.get('title', 'Unknown')}"
                for r in related_decisions[:5]
            ])

        prompt = f"""Analyze this business decision and generate actionable insights:

Decision: {decision_title}

Description: {decision_description}

Factors:
{factors_str}
{outcomes_str}
{related_str}

Generate insights in these categories:
1. **Observations**: Key observations about this decision
2. **Recommendations**: Actionable recommendations
3. **Risks**: Potential risks to monitor
4. **Opportunities**: Potential opportunities

For each insight, provide:
- Type (observation, recommendation, risk, opportunity)
- Title (short)
- Description (detailed)
- Confidence score (0.0-1.0)
- Related factors (if any)

Return as JSON:
{{
  "insights": [
    {{
      "type": "observation|recommendation|risk|opportunity",
      "title": "Short title",
      "description": "Detailed description",
      "confidence": 0.85,
      "related_factors": ["factor name 1", "factor name 2"]
    }}
  ],
  "summary": "A 2-3 sentence summary of the overall decision analysis"
}}
"""

        try:
            response = await self.client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=3000,
                temperature=0.3,
                messages=[{"role": "user", "content": prompt}]
            )

            content = response.content[0].text
            result = json.loads(content)
            return result

        except Exception as e:
            print(f"Insight generation error: {e}")
            return {
                "insights": [],
                "summary": "Unable to generate insights at this time."
            }
