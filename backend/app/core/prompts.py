"""
Prompt templates for AI synthesis and analysis
"""

SYNTHESIS_PROMPT = """You are InnoSynth.ai, an enterprise knowledge synthesis assistant designed to help organizations make better decisions through intelligent analysis of their knowledge base.

Your role is to:
1. Analyze the provided source documents carefully
2. Synthesize a comprehensive, well-structured answer to the user's question
3. Cite specific sources using [Document Title] notation (not [Source N])
4. Provide actionable insights and strategic recommendations when applicable
5. Acknowledge if sources don't fully answer the question and suggest what additional information might be needed
6. Identify patterns, contradictions, or gaps across multiple sources

Guidelines:
- Be concise but thorough - aim for executive-level clarity
- Use business-appropriate, professional language
- Cite sources frequently and accurately
- Highlight key insights and takeaways
- Be honest about limitations in the available data
- Structure your response with clear sections when appropriate
- Include specific data points, dates, and metrics when available
- Flag any conflicting information between sources

Response Structure:
1. Direct answer to the question
2. Key insights and findings (with citations)
3. Supporting details and context
4. Actionable recommendations (if applicable)
5. Limitations or gaps in available information (if any)

Remember: Your goal is to provide maximum value to decision-makers by synthesizing complex information into clear, actionable intelligence."""


DECISION_DETECTION_PROMPT = """Analyze the following query and determine if it requires decision support or strategic analysis.

Decision-support queries typically:
- Ask about strategic options or alternatives
- Seek recommendations on courses of action
- Compare different approaches or solutions
- Evaluate trade-offs or risks
- Request guidance on resource allocation
- Involve "should we" or "which option" type questions

Return a JSON object with:
{
    "is_decision_query": boolean,
    "decision_type": "strategic|tactical|operational|null",
    "confidence": float (0-1),
    "reasoning": "brief explanation"
}

Query: {query}"""


ENTITY_EXTRACTION_PROMPT = """Extract key entities and concepts from the following query to enhance search precision.

Extract:
1. Organizations/companies mentioned
2. People/roles mentioned
3. Products/technologies mentioned
4. Timeframes or dates
5. Geographic locations
6. Key concepts or topics
7. Metrics or KPIs of interest

Return a JSON object with:
{
    "entities": {
        "organizations": [list],
        "people": [list],
        "products": [list],
        "timeframes": [list],
        "locations": [list],
        "concepts": [list],
        "metrics": [list]
    },
    "search_keywords": [list of enhanced search terms],
    "query_intent": "brief description of what user is trying to find"
}

Query: {query}"""


FOLLOW_UP_GENERATION_PROMPT = """Based on the user's query and the synthesized answer, generate 3-5 intelligent follow-up questions that would help the user gain deeper insights.

Follow-up questions should:
- Build on the information provided
- Explore related areas not covered
- Drill deeper into specific aspects
- Uncover potential blind spots
- Help with practical implementation

Original Query: {query}

Synthesized Answer: {answer}

Return a JSON array of follow-up questions:
["question 1", "question 2", "question 3"]"""


CONTEXT_RELEVANCE_PROMPT = """Evaluate the relevance of each source chunk to the user's query and rank them.

For each source, provide:
1. Relevance score (0-1)
2. Key information it contains
3. Whether it directly answers the question
4. Whether it provides supporting context

Return JSON:
{
    "ranked_sources": [
        {
            "source_index": int,
            "relevance_score": float,
            "relevance_reason": "why this source is relevant",
            "key_information": "what this source tells us",
            "is_direct_answer": boolean
        }
    ]
}

Query: {query}

Sources: {sources}"""


CITATION_EXTRACTION_PROMPT = """Extract all document citations from the synthesized answer.

Look for patterns like:
- [Document Title]
- "According to Document Title"
- "As stated in Document Title"

Return JSON:
{
    "citations": [
        {
            "document_title": "exact title mentioned",
            "context": "sentence containing the citation",
            "citation_type": "direct|reference|paraphrase"
        }
    ]
}

Answer: {answer}"""


SUMMARY_GENERATION_PROMPT = """Generate a concise executive summary of the synthesized answer.

The summary should:
- Be 2-3 sentences maximum
- Capture the core answer and key insight
- Be suitable for dashboard display or email subject

Original Answer: {answer}

Return JSON:
{
    "summary": "executive summary text",
    "key_takeaway": "single most important point"
}"""


CONFIDENCE_ASSESSMENT_PROMPT = """Assess the confidence level of the synthesized answer based on available sources.

Consider:
- Number and quality of sources
- Consistency across sources
- Recency of information
- Completeness of coverage
- Any contradictions or gaps

Return JSON:
{
    "confidence_score": float (0-1),
    "confidence_level": "high|medium|low",
    "reasoning": "brief explanation",
    "gaps": ["list of information gaps"],
    "recommendations": ["suggestions for improving answer quality"]
}

Query: {query}
Answer: {answer}
Number of Sources: {num_sources}
Sources Summary: {sources_summary}"""
