"""
Local Query Service - Complete RAG Pipeline with Smart Intent Detection

This service provides a complete RAG (Retrieval-Augmented Generation) pipeline
with intelligent query handling:

1. Intent Detection: Classifies meta vs content questions
2. System Context: LLM knows what data sources are available
3. Embeddings: sentence-transformers (local) or OpenAI
4. Vector search: numpy-based (local)
5. LLM: Claude Sonnet (preferred) or Ollama (local fallback)
6. Confidence-aware responses based on relevance scores

Key improvements:
- Meta questions ("how many documents") get stats, not searches
- System context tells LLM exactly what's indexed
- Higher quality model (Sonnet vs Haiku)
- Acknowledges uncertainty when relevance is low
"""

import logging
import re
import time
from typing import Any

from app.services import claude_service, local_embedding_service, local_vector_store, ollama_service
from app.services.query_preprocessor import get_query_preprocessor
from app.services.synthesis_service import generate_follow_up_questions

logger = logging.getLogger(__name__)

# Use default model (Haiku) - API key may not have access to Sonnet
# Falls back to DEFAULT_MODEL in claude_service.py
PREFERRED_MODEL = None  # Will use claude_service default

# Meta question patterns (about the system itself, not content)
META_PATTERNS = [
    r"how many (documents?|emails?|files?)",
    r"what (do you have|can you) access",
    r"what (sources?|data|information) (do you|are)",
    r"do you have access",
    r"what('s| is) indexed",
    r"what('s| is) available",
    r"can you access my",
    r"are you connected to",
]

# Aggregate/analytical query patterns (require SQL aggregation)
AGGREGATE_PATTERNS = [
    # Top sender patterns
    (r"who (has )?(sent|sends|emailed) (?:me )?(?:the )?most", "top_senders"),
    (r"most (frequent|common) (senders?|emails?)", "top_senders"),
    (r"top (senders?|emailers?)", "top_senders"),
    (r"(who|which) (person|sender|contact) .*most", "top_senders"),
    # Count patterns - sender-based
    (r"how many (emails?|messages?) from ([^?]+)", "count_from_sender"),
    (r"count.*(emails?|messages?) from", "count_from_sender"),
    # Count patterns - topic-based (MUST be before general "how many documents")
    (r"how many (documents?|files?|emails?).*(about|related to|regarding|mentioning|with) ([a-zA-Z0-9_\-\.]+)", "count_about_topic"),
    (r"(documents?|files?|emails?).*(about|related to|regarding|mentioning) ([a-zA-Z0-9_\-\.]+).*how many", "count_about_topic"),
    (r"count.*(documents?|files?).*(about|related to|regarding) ([a-zA-Z0-9_\-\.]+)", "count_about_topic"),
    # Recent activity patterns
    (r"who (has )?(contacted|emailed|messaged) me recently", "recent_senders"),
    (r"recent (senders?|contacts?|emails?)", "recent_senders"),
    # Document size/length patterns
    (r"(longest|largest|biggest) (document|file|email)", "longest_document"),
    (r"(shortest|smallest|tiniest) (document|file|email)", "shortest_document"),
    (r"what('s| is) (the )?(longest|largest|biggest)", "longest_document"),
    (r"what('s| is) (the )?(shortest|smallest)", "shortest_document"),
    (r"how (long|big) is.*(longest|largest)", "longest_document"),
    (r"(document|file|email) (length|size)", "longest_document"),
]

def _detect_query_intent(query: str) -> tuple[str, str | None]:
    """
    Detect the intent of a query.

    Returns:
        Tuple of (intent_type, detected_pattern)
        intent_type: "meta" | "content" | "aggregate"
    """
    query_lower = query.lower()

    # IMPORTANT: Check aggregate patterns FIRST - they are more specific
    # This prevents "how many documents about X" from being caught by
    # the generic META_PATTERN "how many documents"
    for pattern, agg_type in AGGREGATE_PATTERNS:
        if re.search(pattern, query_lower):
            logger.info(f"Aggregate pattern matched: {agg_type} - returning 'content' to allow aggregate handling")
            return ("content", None)  # Let aggregate detection handle it downstream

    for pattern in META_PATTERNS:
        if re.search(pattern, query_lower):
            return ("meta", pattern)

    return ("content", None)


def _detect_aggregate_query(query: str) -> tuple[str | None, str | None]:
    """
    Detect if query is an aggregate/analytical question.

    Returns:
        Tuple of (aggregate_type, matched_pattern)
        aggregate_type: "top_senders" | "count_from_sender" | "recent_senders" | None
    """
    query_lower = query.lower()

    for pattern, agg_type in AGGREGATE_PATTERNS:
        if re.search(pattern, query_lower):
            return (agg_type, pattern)

    return (None, None)


def _run_aggregate_query(
    aggregate_type: str,
    organization_id: str,
    query: str,
    time_filter: str | None = None
) -> dict[str, Any]:
    """
    Run SQL aggregate query for frequency/count analysis.

    Args:
        aggregate_type: Type of aggregate query (top_senders, count_from_sender, etc.)
        organization_id: Organization to query
        query: Original user query (for extracting params like sender name)
        time_filter: Optional SQL time filter clause

    Returns:
        Dictionary with aggregate results
    """
    try:
        from sqlalchemy import create_engine, text
        from app.config import settings

        engine = create_engine(settings.DATABASE_URL.replace('+aiosqlite', ''))

        with engine.connect() as conn:
            if aggregate_type == "top_senders":
                # Get top 10 senders by email count
                result = conn.execute(text("""
                    SELECT
                        author,
                        COUNT(*) as email_count,
                        MAX(created_at) as last_email
                    FROM documents
                    WHERE organization_id = :org_id
                      AND source_system = 'gmail'
                      AND author IS NOT NULL
                      AND author != ''
                    GROUP BY author
                    ORDER BY email_count DESC
                    LIMIT 10
                """), {"org_id": organization_id})

                rows = result.fetchall()
                return {
                    "type": "top_senders",
                    "results": [
                        {
                            "sender": row[0],
                            "count": row[1],
                            "last_email": str(row[2]) if row[2] else None
                        }
                        for row in rows
                    ],
                    "total_found": len(rows)
                }

            elif aggregate_type == "recent_senders":
                # Get senders from last 7 days
                result = conn.execute(text("""
                    SELECT
                        author,
                        COUNT(*) as email_count,
                        MAX(created_at) as last_email
                    FROM documents
                    WHERE organization_id = :org_id
                      AND source_system = 'gmail'
                      AND author IS NOT NULL
                      AND created_at >= datetime('now', '-7 days')
                    GROUP BY author
                    ORDER BY last_email DESC
                    LIMIT 15
                """), {"org_id": organization_id})

                rows = result.fetchall()
                return {
                    "type": "recent_senders",
                    "results": [
                        {
                            "sender": row[0],
                            "count": row[1],
                            "last_email": str(row[2]) if row[2] else None
                        }
                        for row in rows
                    ],
                    "total_found": len(rows)
                }

            elif aggregate_type == "count_from_sender":
                # Try to extract sender name from query
                sender_match = re.search(r"from\s+([^?]+)", query.lower())
                sender_name = sender_match.group(1).strip() if sender_match else ""

                result = conn.execute(text("""
                    SELECT
                        author,
                        COUNT(*) as email_count
                    FROM documents
                    WHERE organization_id = :org_id
                      AND source_system = 'gmail'
                      AND LOWER(author) LIKE :sender
                    GROUP BY author
                """), {"org_id": organization_id, "sender": f"%{sender_name}%"})

                rows = result.fetchall()
                return {
                    "type": "count_from_sender",
                    "search_term": sender_name,
                    "results": [
                        {"sender": row[0], "count": row[1]}
                        for row in rows
                    ],
                    "total_count": sum(row[1] for row in rows)
                }

            elif aggregate_type == "count_about_topic":
                # Extract topic from query - look for keywords after "about/related to/regarding"
                topic_match = re.search(
                    r"(?:about|related to|regarding|mentioning|with)\s+([a-zA-Z0-9_\-\.]+)",
                    query,
                    re.IGNORECASE
                )
                topic = topic_match.group(1).strip() if topic_match else ""

                if not topic:
                    # Fallback: try to find capitalized words that might be topics
                    words = re.findall(r'\b([A-Z][a-zA-Z0-9]+)\b', query)
                    topic = words[0] if words else ""

                logger.info(f"Topic search: '{topic}' from query: '{query}'")

                # Search for documents with topic in title (most reliable)
                result = conn.execute(text("""
                    SELECT
                        title,
                        source_system,
                        created_at
                    FROM documents
                    WHERE organization_id = :org_id
                      AND (LOWER(title) LIKE :topic_lower)
                    ORDER BY created_at DESC
                    LIMIT 25
                """), {"org_id": organization_id, "topic_lower": f"%{topic.lower()}%"})

                rows = result.fetchall()

                # Also get count by source system
                count_result = conn.execute(text("""
                    SELECT
                        source_system,
                        COUNT(*) as count
                    FROM documents
                    WHERE organization_id = :org_id
                      AND (LOWER(title) LIKE :topic_lower)
                    GROUP BY source_system
                """), {"org_id": organization_id, "topic_lower": f"%{topic.lower()}%"})

                source_counts = {row[0]: row[1] for row in count_result.fetchall()}
                total_count = sum(source_counts.values())

                return {
                    "type": "count_about_topic",
                    "topic": topic,
                    "total_count": total_count,
                    "by_source": source_counts,
                    "sample_documents": [
                        {
                            "title": row[0],
                            "source": row[1],
                            "date": str(row[2]) if row[2] else None
                        }
                        for row in rows[:10]  # Return top 10 as samples
                    ]
                }

            elif aggregate_type == "longest_document":
                # Find longest documents by content length
                result = conn.execute(text("""
                    SELECT
                        document_id,
                        title,
                        source_system,
                        LENGTH(content) as content_length,
                        author,
                        source_url,
                        mime_type,
                        created_at
                    FROM documents
                    WHERE organization_id = :org_id
                      AND content IS NOT NULL
                    ORDER BY content_length DESC
                    LIMIT 5
                """), {"org_id": organization_id})

                rows = result.fetchall()

                # Format content length nicely
                def format_length(chars):
                    if chars > 1000000:
                        return f"{chars / 1000000:.1f}M characters (~{chars // 5000} pages)"
                    elif chars > 1000:
                        return f"{chars / 1000:.1f}K characters (~{chars // 5000} pages)"
                    return f"{chars} characters"

                return {
                    "type": "longest_document",
                    "results": [
                        {
                            "document_id": row[0],
                            "title": row[1],
                            "source_system": row[2],
                            "content_length": row[3],
                            "content_length_formatted": format_length(row[3]),
                            "author": row[4],
                            "source_url": row[5],
                            "mime_type": row[6],
                            "date": str(row[7]) if row[7] else None
                        }
                        for row in rows
                    ],
                    "total_found": len(rows),
                    "longest": {
                        "title": rows[0][1] if rows else None,
                        "length": rows[0][3] if rows else 0,
                        "length_formatted": format_length(rows[0][3]) if rows else "0 characters"
                    } if rows else None
                }

            elif aggregate_type == "shortest_document":
                # Find shortest documents by content length (excluding empty)
                result = conn.execute(text("""
                    SELECT
                        document_id,
                        title,
                        source_system,
                        LENGTH(content) as content_length,
                        author,
                        source_url,
                        mime_type,
                        created_at
                    FROM documents
                    WHERE organization_id = :org_id
                      AND content IS NOT NULL
                      AND LENGTH(content) > 0
                    ORDER BY content_length ASC
                    LIMIT 5
                """), {"org_id": organization_id})

                rows = result.fetchall()

                def format_length(chars):
                    if chars > 1000:
                        return f"{chars / 1000:.1f}K characters"
                    return f"{chars} characters"

                return {
                    "type": "shortest_document",
                    "results": [
                        {
                            "document_id": row[0],
                            "title": row[1],
                            "source_system": row[2],
                            "content_length": row[3],
                            "content_length_formatted": format_length(row[3]),
                            "author": row[4],
                            "source_url": row[5],
                            "mime_type": row[6],
                            "date": str(row[7]) if row[7] else None
                        }
                        for row in rows
                    ],
                    "total_found": len(rows),
                    "shortest": {
                        "title": rows[0][1] if rows else None,
                        "length": rows[0][3] if rows else 0,
                        "length_formatted": format_length(rows[0][3]) if rows else "0 characters"
                    } if rows else None
                }

    except Exception as e:
        logger.error(f"Aggregate query error: {e}")
        return {"type": aggregate_type, "error": str(e), "results": []}

    return {"type": aggregate_type, "results": []}


def _get_system_context(organization_id: str) -> dict[str, Any]:
    """Get context about what data is available for this organization."""
    try:
        stats = local_vector_store.get_stats(organization_id)

        # Dynamically determine available data sources from what's indexed
        data_sources = []
        not_available = []
        connected_accounts = {}  # Store email addresses for connected accounts

        # Check what source systems are actually indexed for this org
        try:
            from sqlalchemy import create_engine, text
            from app.config import settings

            # Use sync engine for this quick query
            engine = create_engine(settings.DATABASE_URL.replace('+aiosqlite', ''))
            with engine.connect() as conn:
                result = conn.execute(text("""
                    SELECT source_system, COUNT(*) as count
                    FROM documents
                    WHERE organization_id = :org_id AND status = 'indexed'
                    GROUP BY source_system
                """), {"org_id": organization_id})

                source_counts = {row[0]: row[1] for row in result}

                # Query OAuth connections to get the actual email addresses
                oauth_result = conn.execute(text("""
                    SELECT provider, connected_user_email, connected_user_name, status
                    FROM oauth_connections
                    WHERE organization_id = :org_id AND status = 'active'
                """), {"org_id": organization_id})

                for row in oauth_result:
                    provider = row[0]
                    email = row[1]
                    name = row[2]
                    if provider and email:
                        connected_accounts[provider] = {
                            "email": email,
                            "name": name
                        }

            # Build data sources list based on what's actually indexed
            if source_counts.get('gmail', 0) > 0:
                gmail_info = connected_accounts.get('gmail', {})
                email = gmail_info.get('email', 'unknown account')
                data_sources.append(f"Gmail inbox: {email} ({source_counts['gmail']} emails indexed)")
            if source_counts.get('google_drive', 0) > 0:
                drive_info = connected_accounts.get('google_drive', connected_accounts.get('google', {}))
                email = drive_info.get('email', 'unknown account')
                data_sources.append(f"Google Drive: {email} ({source_counts['google_drive']} documents indexed)")
            if source_counts.get('upload', 0) > 0:
                data_sources.append(f"Uploaded documents ({source_counts['upload']} indexed)")

            # Determine what's not available
            all_possible = ["Gmail", "Google Drive", "Google Calendar", "Outlook", "Slack"]
            available_types = []
            if source_counts.get('gmail', 0) > 0:
                available_types.append("Gmail")
            if source_counts.get('google_drive', 0) > 0:
                available_types.append("Google Drive")
            not_available = [s for s in all_possible if s not in available_types]

        except Exception as db_error:
            logger.warning(f"Could not query data sources: {db_error}")
            data_sources = ["Unknown - database query failed"]
            not_available = ["Google Calendar", "Outlook", "Slack"]

        return {
            "total_documents": stats.get("total_documents", 0),
            "total_chunks": stats.get("total_chunks", 0),
            "data_sources": data_sources,
            "not_available": not_available,
            "connected_accounts": connected_accounts,
        }
    except Exception as e:
        logger.warning(f"Could not get system context: {e}")
        return {
            "total_documents": 0,
            "total_chunks": 0,
            "data_sources": [],
            "not_available": ["Google Drive", "Google Calendar", "Outlook", "Slack"],
            "connected_accounts": {},
        }


def _get_document_metadata(document_ids: list[str]) -> dict[str, dict]:
    """
    Fetch author and other metadata for documents from the database.
    Returns a dict mapping document_id -> {author, source_system, ...}
    """
    if not document_ids:
        return {}

    try:
        from sqlalchemy import create_engine, text
        from app.config import settings

        engine = create_engine(settings.DATABASE_URL.replace('+aiosqlite', ''))
        with engine.connect() as conn:
            # Build placeholders for IN clause
            placeholders = ','.join([f':id{i}' for i in range(len(document_ids))])
            params = {f'id{i}': doc_id for i, doc_id in enumerate(document_ids)}

            result = conn.execute(text(f"""
                SELECT document_id, author, source_system, source_url, mime_type
                FROM documents
                WHERE document_id IN ({placeholders})
            """), params)

            return {
                row[0]: {
                    "author": row[1],
                    "source_system": row[2],
                    "source_url": row[3],
                    "mime_type": row[4]
                }
                for row in result
            }
    except Exception as e:
        logger.warning(f"Could not fetch document metadata: {e}")
        return {}


def _build_system_prompt(system_context: dict[str, Any]) -> str:
    """Build a system prompt with context about available data."""
    sources = ", ".join(system_context["data_sources"]) or "No data sources connected"
    not_available = ", ".join(system_context["not_available"])

    # Build connected accounts detail
    connected_accounts = system_context.get("connected_accounts", {})
    accounts_detail = ""
    if connected_accounts:
        accounts_list = []
        for provider, info in connected_accounts.items():
            email = info.get("email", "unknown")
            name = info.get("name", "")
            if name:
                accounts_list.append(f"{provider}: {email} ({name})")
            else:
                accounts_list.append(f"{provider}: {email}")
        accounts_detail = f"\n- Connected accounts: {', '.join(accounts_list)}"

    return f"""You are an intelligent knowledge assistant with access to the user's indexed documents.

SYSTEM CONTEXT - WHAT YOU HAVE ACCESS TO:
- Data sources connected: {sources}{accounts_detail}
- Total documents indexed: {system_context['total_documents']}
- Total searchable chunks: {system_context['total_chunks']}

IMPORTANT - WHAT YOU DO NOT HAVE ACCESS TO:
- {not_available}

When the user asks about which accounts or data sources you have access to, ALWAYS mention the specific email address(es) connected. Be explicit about the actual email addresses, not just generic descriptions.

If the user asks about data sources you don't have access to, clearly explain:
1. What you DO have access to (including specific email addresses)
2. What you DON'T have access to
3. How they can connect additional sources if available

Be honest about your limitations. Never make up information about sources you can't access."""


# Synthesis prompt for content questions
SYNTHESIS_PROMPT = """Based on the provided documents, answer the user's question.

CRITICAL INSTRUCTIONS:
1. If documents are relevant, analyze and synthesize the information
2. Classify and categorize when appropriate (email types, topics, etc.)
3. Provide counts and summaries, not raw document dumps
4. If the relevance scores are low (<50%), acknowledge uncertainty
5. Be specific - mention document titles, dates, and key details
6. If asked about date ranges, filter and mention which items match

RELEVANCE CONTEXT:
The search found {num_sources} documents with an average relevance of {avg_relevance}%.
{relevance_note}

DOCUMENTS:
{context}

USER'S QUESTION: {query}

Provide a helpful, accurate answer:"""


async def _handle_meta_query(
    query: str,
    organization_id: str,
    system_context: dict[str, Any]
) -> dict[str, Any]:
    """
    Handle meta questions about the system (not content questions).

    Examples:
    - "How many documents do you have access to?"
    - "What sources are connected?"
    - "Do you have access to my Google Drive?"
    """
    start_time = time.time()

    # Build a direct answer about system capabilities
    system_prompt = _build_system_prompt(system_context)

    prompt = f"""The user is asking about your capabilities and data access.

USER QUESTION: {query}

Based on the system context provided, give a clear, honest answer about:
1. What data sources you have access to
2. How many documents are indexed
3. What you do NOT have access to

Be direct and helpful. If they're asking about something you can't access (like Google Drive),
explain that clearly and mention what you DO have access to instead."""

    # Use Claude Sonnet for better reasoning
    if claude_service.is_available():
        result = await claude_service.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.3,
            max_tokens=800,
            model=PREFERRED_MODEL
        )

        if result["success"]:
            return {
                "answer": result["response"],
                "sources": [],
                "metrics": {
                    "total_time_ms": int((time.time() - start_time) * 1000),
                    "query_type": "meta",
                    "model": result.get("model"),
                    "input_tokens": result.get("input_tokens", 0),
                    "output_tokens": result.get("output_tokens", 0),
                },
                "synthesis_method": f"claude ({result.get('model', 'unknown')})"
            }

    # Fallback: direct answer without LLM
    sources_list = ", ".join(system_context["data_sources"]) or "No sources connected"
    not_available = ", ".join(system_context["not_available"])

    answer = f"""Here's what I have access to:

**Connected Data Sources:** {sources_list}
**Total Documents Indexed:** {system_context['total_documents']}

**Not Currently Connected:**
- {not_available}

To connect additional data sources like Google Drive, you would need to set up that integration in your account settings."""

    return {
        "answer": answer,
        "sources": [],
        "metrics": {
            "total_time_ms": int((time.time() - start_time) * 1000),
            "query_type": "meta",
        },
        "synthesis_method": "direct_response"
    }


async def process_query(
    query: str,
    organization_id: str,
    max_sources: int = 15,
    use_llm: bool = True
) -> dict[str, Any]:
    """
    Process a query through the intelligent RAG pipeline.

    Pipeline:
    1. Detect query intent (meta vs content)
    2. For meta questions: Return system stats directly
    3. For content questions: Search → Synthesize with context
    4. Use Claude Sonnet for better reasoning
    5. Include confidence awareness based on relevance scores

    Args:
        query: User's question
        organization_id: Organization to search in
        max_sources: Maximum number of sources to retrieve
        use_llm: Whether to use LLM for synthesis (if available)

    Returns:
        Dictionary with answer, sources, and metadata
    """
    start_time = time.time()

    # Get system context (what data sources are available)
    system_context = _get_system_context(organization_id)

    # Step 1: Detect query intent
    intent_type, matched_pattern = _detect_query_intent(query)
    logger.info(f"Query intent: {intent_type}, pattern: {matched_pattern}")

    # Step 2: Handle meta questions directly (no search needed)
    if intent_type == "meta":
        return await _handle_meta_query(query, organization_id, system_context)

    # Step 2.5: Detect aggregate/analytical queries
    aggregate_type, agg_pattern = _detect_aggregate_query(query)
    aggregate_data = None
    if aggregate_type:
        logger.info(f"Aggregate query detected: {aggregate_type}, pattern: {agg_pattern}")
        aggregate_data = _run_aggregate_query(aggregate_type, organization_id, query)
        logger.info(f"Aggregate results: {len(aggregate_data.get('results', []))} items")

    # Step 2.6: Preprocess query for temporal expansion
    preprocessor = get_query_preprocessor()
    enhanced_query, prep_metadata = preprocessor.preprocess(query)

    # Log if temporal references were found
    if prep_metadata.get("temporal_references_found"):
        logger.info(f"Temporal expansion: '{query}' -> '{enhanced_query}'")
        logger.info(f"Date range: {prep_metadata.get('date_range')}")

    # Step 3: Content question - do semantic search
    metrics = {
        "search_time_ms": 0,
        "synthesis_time_ms": 0,
        "total_time_ms": 0,
        "ollama_available": False,
        "sources_found": 0,
        "query_type": "hybrid" if aggregate_data else "content",
        "aggregate_type": aggregate_type,
        "avg_relevance": 0,
    }

    search_start = time.time()
    search_results = local_vector_store.search_deduplicated(
        query=enhanced_query,  # Use preprocessed query with temporal expansion
        organization_id=organization_id,
        limit=max_sources,
        min_score=0.25  # Slightly lower threshold
    )
    metrics["search_time_ms"] = int((time.time() - search_start) * 1000)
    metrics["sources_found"] = len(search_results)

    # Calculate average relevance
    if search_results:
        avg_relevance = sum(r['similarity'] for r in search_results) / len(search_results)
        metrics["avg_relevance"] = round(avg_relevance * 100, 1)
    else:
        avg_relevance = 0

    # Fetch author metadata for all documents
    doc_ids = [r['metadata'].get('document_id') for r in search_results if r['metadata'].get('document_id')]
    doc_metadata = _get_document_metadata(doc_ids)

    # Format sources for response
    sources = []
    for result in search_results:
        doc_id = result['metadata'].get('document_id')
        meta = doc_metadata.get(doc_id, {})
        sources.append({
            "document_id": doc_id,
            "title": result['metadata'].get('title', 'Untitled'),
            "author": meta.get('author'),  # Include sender/author
            "excerpt": result['content'][:500] if result['content'] else "",
            "relevance_score": result['similarity'],
            "source_system": meta.get('source_system'),  # gmail, google_drive, upload
            "source_url": meta.get('source_url'),  # URL to open document
            "mime_type": meta.get('mime_type'),  # PDF, DOCX, etc.
        })

    # If no sources found, return helpful message
    if not search_results:
        metrics["total_time_ms"] = int((time.time() - start_time) * 1000)

        # Provide context about what IS available
        sources_info = f"I have {system_context['total_documents']} Gmail emails indexed."
        not_available = ", ".join(system_context["not_available"])

        return {
            "answer": f"I couldn't find any relevant documents matching your query.\n\n**What I have access to:** {sources_info}\n**Not connected:** {not_available}\n\nTry rephrasing your question or asking about emails specifically.",
            "sources": [],
            "metrics": metrics,
            "synthesis_method": "none"
        }

    # Step 4: Build context from search results
    context_parts = []
    for i, result in enumerate(search_results, 1):
        doc_id = result['metadata'].get('document_id')
        title = result['metadata'].get('title', f'Document {i}')
        content = result['content']
        score = result['similarity']
        # Include author/sender info if available
        meta = doc_metadata.get(doc_id, {})
        author = meta.get('author')
        if author:
            context_parts.append(f"[{i}] {title} | From: {author} (relevance: {score:.0%}):\n{content}\n")
        else:
            context_parts.append(f"[{i}] {title} (relevance: {score:.0%}):\n{content}\n")

    context = "\n".join(context_parts)

    # Add aggregate data to context if available (hybrid query)
    aggregate_context = ""
    if aggregate_data and (aggregate_data.get("results") or aggregate_data.get("sample_documents") or aggregate_data.get("total_count")):
        if aggregate_data["type"] == "top_senders":
            aggregate_context = "\n\n📊 DATABASE ANALYSIS - Top Email Senders (by frequency):\n"
            for i, sender in enumerate(aggregate_data["results"], 1):
                aggregate_context += f"  {i}. {sender['sender']} - {sender['count']} emails\n"
        elif aggregate_data["type"] == "recent_senders":
            aggregate_context = "\n\n📊 DATABASE ANALYSIS - Recent Senders:\n"
            for i, sender in enumerate(aggregate_data["results"], 1):
                aggregate_context += f"  {i}. {sender['sender']} - {sender['count']} emails (last: {sender.get('last_email', 'unknown')})\n"
        elif aggregate_data["type"] == "count_from_sender":
            aggregate_context = f"\n\n📊 DATABASE ANALYSIS - Email Count from '{aggregate_data.get('search_term', 'unknown')}':\n"
            for sender in aggregate_data["results"]:
                aggregate_context += f"  - {sender['sender']}: {sender['count']} emails\n"
            aggregate_context += f"  Total: {aggregate_data.get('total_count', 0)} emails\n"
        elif aggregate_data["type"] == "count_about_topic":
            topic = aggregate_data.get("topic", "unknown")
            total = aggregate_data.get("total_count", 0)
            by_source = aggregate_data.get("by_source", {})
            samples = aggregate_data.get("sample_documents", [])

            aggregate_context = f"\n\n📊 DATABASE ANALYSIS - Documents about '{topic}':\n"
            aggregate_context += f"  TOTAL: {total} documents found\n\n"

            if by_source:
                aggregate_context += "  By source:\n"
                for source, count in by_source.items():
                    aggregate_context += f"    - {source}: {count} documents\n"

            if samples:
                aggregate_context += f"\n  Sample documents (showing {len(samples)} of {total}):\n"
                for i, doc in enumerate(samples, 1):
                    aggregate_context += f"    {i}. {doc['title']} ({doc['source']})\n"

        elif aggregate_data["type"] == "longest_document":
            longest = aggregate_data.get("longest", {})
            results = aggregate_data.get("results", [])

            aggregate_context = "\n\n📊 DATABASE ANALYSIS - Longest Documents:\n"
            if longest:
                aggregate_context += f"  🏆 LONGEST: {longest.get('title', 'Unknown')}\n"
                aggregate_context += f"     Length: {longest.get('length_formatted', 'Unknown')}\n\n"

            aggregate_context += "  Top 5 longest documents:\n"
            for i, doc in enumerate(results, 1):
                source_emoji = "📧" if doc.get("source_system") == "gmail" else "📄"
                aggregate_context += f"    {i}. {source_emoji} {doc['title']}\n"
                aggregate_context += f"       Length: {doc.get('content_length_formatted', 'Unknown')}\n"
                aggregate_context += f"       Source: {doc.get('source_system', 'unknown')}\n"

        elif aggregate_data["type"] == "shortest_document":
            shortest = aggregate_data.get("shortest", {})
            results = aggregate_data.get("results", [])

            aggregate_context = "\n\n📊 DATABASE ANALYSIS - Shortest Documents:\n"
            if shortest:
                aggregate_context += f"  📎 SHORTEST: {shortest.get('title', 'Unknown')}\n"
                aggregate_context += f"     Length: {shortest.get('length_formatted', 'Unknown')}\n\n"

            aggregate_context += "  Top 5 shortest documents:\n"
            for i, doc in enumerate(results, 1):
                source_emoji = "📧" if doc.get("source_system") == "gmail" else "📄"
                aggregate_context += f"    {i}. {source_emoji} {doc['title']}\n"
                aggregate_context += f"       Length: {doc.get('content_length_formatted', 'Unknown')}\n"
                aggregate_context += f"       Source: {doc.get('source_system', 'unknown')}\n"

        # Prepend aggregate data to context (so LLM sees it first)
        context = aggregate_context + "\n\n📄 SEMANTIC SEARCH RESULTS:\n" + context

    # Build relevance note for prompt
    if avg_relevance >= 0.6:
        relevance_note = "These documents appear highly relevant to the question."
    elif avg_relevance >= 0.45:
        relevance_note = "These documents have moderate relevance. Some information may be tangential."
    else:
        relevance_note = "⚠️ These documents have LOW relevance scores. Be cautious and acknowledge uncertainty in your answer."

    # Step 5: Synthesize answer using LLM
    answer = None
    synthesis_method = "search_only"

    if use_llm:
        synthesis_start = time.time()

        # Build prompt with relevance context
        prompt = SYNTHESIS_PROMPT.format(
            context=context,
            query=query,
            num_sources=len(search_results),
            avg_relevance=metrics["avg_relevance"],
            relevance_note=relevance_note
        )

        # Get system prompt with data source context
        system_prompt = _build_system_prompt(system_context)

        # Try Claude Sonnet first (better quality)
        if claude_service.is_available():
            logger.info("Using Claude Sonnet for synthesis")
            metrics["claude_available"] = True

            claude_result = await claude_service.generate(
                prompt=prompt,
                system_prompt=system_prompt,
                temperature=0.3,
                max_tokens=1500,
                model=PREFERRED_MODEL  # Use Sonnet instead of Haiku
            )

            if claude_result["success"]:
                answer = claude_result["response"]
                synthesis_method = f"claude ({claude_result.get('model', 'unknown')})"
                metrics["synthesis_time_ms"] = int((time.time() - synthesis_start) * 1000)
                metrics["input_tokens"] = claude_result.get("input_tokens", 0)
                metrics["output_tokens"] = claude_result.get("output_tokens", 0)
            else:
                logger.warning(f"Claude synthesis failed: {claude_result.get('message')}")

        # Fall back to Ollama if Claude unavailable
        if not answer:
            ollama_available = await ollama_service.is_available()
            metrics["ollama_available"] = ollama_available

            if ollama_available:
                llm_result = await ollama_service.generate(
                    prompt=prompt,
                    temperature=0.3,
                    max_tokens=1024
                )

                if llm_result["success"]:
                    answer = llm_result["response"]
                    synthesis_method = f"ollama ({llm_result.get('model', 'unknown')})"
                    metrics["synthesis_time_ms"] = int((time.time() - synthesis_start) * 1000)
                    metrics["ollama_tokens"] = llm_result.get("tokens_generated", 0)
                else:
                    logger.warning(f"Ollama synthesis failed: {llm_result.get('message')}")

    # If no LLM answer, create a summary from search results
    if not answer:
        answer = f"Based on your search, I found {len(sources)} potentially relevant document(s):\n\n"
        for i, source in enumerate(sources, 1):
            answer += f"**{i}. {source['title']}** (relevance: {source['relevance_score']:.0%})\n"
            answer += f"> {source['excerpt'][:200]}...\n\n"

        if avg_relevance < 0.5:
            answer += "\n⚠️ *Note: These results have low relevance scores. Your question may not match the indexed content well.*"

        answer += "\n\n*For AI-powered answers, ensure Claude API key is configured or install Ollama locally.*"

    metrics["total_time_ms"] = int((time.time() - start_time) * 1000)

    # Generate follow-up questions
    follow_up_questions = []
    if answer and use_llm:
        try:
            follow_up_questions = await generate_follow_up_questions(query, answer)
        except Exception as e:
            logger.warning(f"Failed to generate follow-up questions: {e}")

    return {
        "answer": answer,
        "sources": sources,
        "metrics": metrics,
        "synthesis_method": synthesis_method,
        "follow_up_questions": follow_up_questions,
        "aggregate_data": aggregate_data  # Include SQL aggregate results if available
    }


async def get_service_status() -> dict[str, Any]:
    """
    Get status of all local AI services.

    Returns:
        Dictionary with service statuses
    """
    # Check embedding service
    embedding_ok = local_embedding_service.is_available()
    embedding_info = local_embedding_service.get_model_info()

    # Check vector store
    vector_ok = local_vector_store.is_available()

    # Check Ollama
    ollama_ok = await ollama_service.is_available()
    ollama_models = await ollama_service.get_available_models() if ollama_ok else []

    return {
        "embedding_service": {
            "available": embedding_ok,
            "model": embedding_info['model_name'],
            "dimension": embedding_info['embedding_dimension'],
            "requires_api_key": False
        },
        "vector_store": {
            "available": vector_ok,
            "type": "local (numpy + pickle)",
            "requires_api_key": False
        },
        "llm_service": {
            "available": ollama_ok,
            "type": "ollama (local)",
            "models": ollama_models,
            "requires_api_key": False,
            "installation": "curl -fsSL https://ollama.ai/install.sh | sh && ollama pull llama3.2"
        },
        "rag_ready": embedding_ok and vector_ok,
        "synthesis_ready": embedding_ok and vector_ok and ollama_ok
    }


async def index_document_for_search(
    document_id: str,
    organization_id: str,
    title: str,
    content: str,
    metadata: dict[str, Any] | None = None
) -> dict[str, Any]:
    """
    Index a document for semantic search.

    Args:
        document_id: Unique document identifier
        organization_id: Organization the document belongs to
        title: Document title
        content: Document text content
        metadata: Additional metadata

    Returns:
        Dictionary with indexing results
    """
    try:
        chunks_indexed = local_vector_store.index_document(
            document_id=document_id,
            organization_id=organization_id,
            title=title,
            content=content,
            metadata=metadata
        )

        return {
            "success": True,
            "document_id": document_id,
            "chunks_indexed": chunks_indexed,
            "message": f"Successfully indexed {chunks_indexed} chunks"
        }

    except Exception as e:
        logger.error(f"Error indexing document: {e}")
        return {
            "success": False,
            "document_id": document_id,
            "chunks_indexed": 0,
            "error": str(e)
        }


async def remove_document_from_search(
    document_id: str,
    organization_id: str
) -> dict[str, Any]:
    """
    Remove a document from the search index.

    Args:
        document_id: Document to remove
        organization_id: Organization the document belongs to

    Returns:
        Dictionary with removal results
    """
    try:
        success = local_vector_store.remove_document(
            document_id=document_id,
            organization_id=organization_id
        )

        return {
            "success": success,
            "document_id": document_id,
            "message": "Document removed from search index" if success else "Failed to remove"
        }

    except Exception as e:
        logger.error(f"Error removing document from index: {e}")
        return {
            "success": False,
            "document_id": document_id,
            "error": str(e)
        }
