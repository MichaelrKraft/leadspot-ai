"""
Unified Synthesis Service with Cloud/Local Fallback

Automatically selects the best available LLM provider:
1. Claude (Anthropic) - if ANTHROPIC_API_KEY is configured
2. Ollama (Local) - always available fallback

This ensures the app works without any API keys while providing
better quality synthesis when cloud services are available.
"""

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

# Provider constants
PROVIDER_CLAUDE = "claude"
PROVIDER_OLLAMA = "ollama"

# Current provider (determined at runtime)
_current_provider: str | None = None


def _get_anthropic_api_key() -> str | None:
    """Get Anthropic API key from settings or environment."""
    try:
        from app.config import settings
        key = getattr(settings, 'ANTHROPIC_API_KEY', None)
    except ImportError:
        key = None

    if not key:
        key = os.getenv('ANTHROPIC_API_KEY')

    return key if key and key.strip() else None


def get_current_provider() -> str:
    """
    Determine and return the current synthesis provider.

    Returns:
        'claude' if API key is configured, 'ollama' otherwise
    """
    global _current_provider

    if _current_provider is not None:
        return _current_provider

    if _get_anthropic_api_key():
        _current_provider = PROVIDER_CLAUDE
        logger.info("Using Claude for AI synthesis (Anthropic API)")
    else:
        _current_provider = PROVIDER_OLLAMA
        logger.info("Using Ollama for AI synthesis (local)")

    return _current_provider


def get_provider_info() -> dict:
    """Get information about the current synthesis provider."""
    provider = get_current_provider()

    if provider == PROVIDER_CLAUDE:
        return {
            "provider": "anthropic",
            "model": "claude-3-haiku-20240307",
            "requires_api_key": True,
            "api_key_configured": True
        }
    else:
        return {
            "provider": "ollama (local)",
            "model": "llama3.2",
            "requires_api_key": False,
            "api_key_configured": False
        }


async def is_available() -> bool:
    """Check if any synthesis provider is available."""
    provider = get_current_provider()

    if provider == PROVIDER_CLAUDE:
        return True  # API key is configured
    else:
        from app.services import ollama_service
        return await ollama_service.is_available()


async def generate(
    prompt: str,
    system_prompt: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 2048,
    force_local: bool = False
) -> dict[str, Any]:
    """
    Generate text using the best available provider.

    Automatically uses Claude if configured, falls back to Ollama otherwise.

    Args:
        prompt: The user prompt
        system_prompt: Optional system instructions
        temperature: Sampling temperature (0.0-1.0)
        max_tokens: Maximum tokens to generate
        force_local: Force use of Ollama even if Claude is available

    Returns:
        Dictionary with response and metadata
    """
    provider = PROVIDER_OLLAMA if force_local else get_current_provider()

    if provider == PROVIDER_CLAUDE:
        return await _generate_claude(prompt, system_prompt, temperature, max_tokens)
    else:
        return await _generate_ollama(prompt, system_prompt, temperature, max_tokens)


async def chat(
    messages: list[dict[str, str]],
    system_prompt: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 2048,
    force_local: bool = False
) -> dict[str, Any]:
    """
    Chat completion using the best available provider.

    Args:
        messages: List of {"role": "user/assistant/system", "content": "..."}
        system_prompt: Optional system instructions
        temperature: Sampling temperature
        max_tokens: Maximum tokens to generate
        force_local: Force use of Ollama

    Returns:
        Dictionary with response and metadata
    """
    provider = PROVIDER_OLLAMA if force_local else get_current_provider()

    if provider == PROVIDER_CLAUDE:
        return await _chat_claude(messages, system_prompt, temperature, max_tokens)
    else:
        return await _chat_ollama(messages, temperature, max_tokens)


# ============================================================================
# Claude Implementation
# ============================================================================

async def _generate_claude(
    prompt: str,
    system_prompt: str | None,
    temperature: float,
    max_tokens: int
) -> dict[str, Any]:
    """Generate text using Claude API."""
    api_key = _get_anthropic_api_key()
    if not api_key:
        logger.warning("Claude API key not available, falling back to Ollama")
        return await _generate_ollama(prompt, system_prompt, temperature, max_tokens)

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

        message_params = {
            "model": "claude-3-haiku-20240307",
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}]
        }

        if system_prompt:
            message_params["system"] = system_prompt

        if temperature != 0.7:
            message_params["temperature"] = temperature

        response = client.messages.create(**message_params)

        return {
            "success": True,
            "response": response.content[0].text,
            "model": "claude-3-haiku-20240307",
            "provider": PROVIDER_CLAUDE,
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens
        }

    except Exception as e:
        logger.error(f"Claude generate error: {e}, falling back to Ollama")
        return await _generate_ollama(prompt, system_prompt, temperature, max_tokens)


async def _chat_claude(
    messages: list[dict[str, str]],
    system_prompt: str | None,
    temperature: float,
    max_tokens: int
) -> dict[str, Any]:
    """Chat using Claude API."""
    api_key = _get_anthropic_api_key()
    if not api_key:
        logger.warning("Claude API key not available, falling back to Ollama")
        return await _chat_ollama(messages, temperature, max_tokens)

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

        # Convert messages (Claude uses "user" and "assistant" only)
        claude_messages = []
        for msg in messages:
            role = msg.get("role", "user")
            if role == "system":
                if not system_prompt:
                    system_prompt = msg.get("content", "")
                continue
            claude_messages.append({
                "role": role if role in ["user", "assistant"] else "user",
                "content": msg.get("content", "")
            })

        message_params = {
            "model": "claude-3-haiku-20240307",
            "max_tokens": max_tokens,
            "messages": claude_messages
        }

        if system_prompt:
            message_params["system"] = system_prompt

        if temperature != 0.7:
            message_params["temperature"] = temperature

        response = client.messages.create(**message_params)

        return {
            "success": True,
            "response": response.content[0].text,
            "model": "claude-3-haiku-20240307",
            "provider": PROVIDER_CLAUDE
        }

    except Exception as e:
        logger.error(f"Claude chat error: {e}, falling back to Ollama")
        return await _chat_ollama(messages, temperature, max_tokens)


# ============================================================================
# Ollama Implementation
# ============================================================================

async def _generate_ollama(
    prompt: str,
    system_prompt: str | None,
    temperature: float,
    max_tokens: int
) -> dict[str, Any]:
    """Generate text using Ollama."""
    from app.services import ollama_service

    result = await ollama_service.generate(
        prompt=prompt,
        system_prompt=system_prompt,
        temperature=temperature,
        max_tokens=max_tokens
    )

    result["provider"] = PROVIDER_OLLAMA
    return result


async def _chat_ollama(
    messages: list[dict[str, str]],
    temperature: float,
    max_tokens: int
) -> dict[str, Any]:
    """Chat using Ollama."""
    from app.services import ollama_service

    result = await ollama_service.chat(
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens
    )

    result["provider"] = PROVIDER_OLLAMA
    return result


# ============================================================================
# Knowledge Synthesis (RAG)
# ============================================================================

async def synthesize_knowledge(
    query: str,
    context_chunks: list[str],
    source_documents: list[dict] | None = None,
    force_local: bool = False
) -> dict[str, Any]:
    """
    Synthesize an answer from context chunks using the best available provider.

    This is the main RAG synthesis function.

    Args:
        query: User's question
        context_chunks: Relevant text chunks from documents
        source_documents: Optional metadata about source documents
        force_local: Force use of Ollama

    Returns:
        Dictionary with synthesized answer and metadata
    """
    if not context_chunks:
        return {
            "success": False,
            "error": "no_context",
            "message": "No relevant context found to answer the question",
            "response": None,
            "provider": get_current_provider()
        }

    # Build context string
    context = "\n\n---\n\n".join(context_chunks[:5])

    # Build source citations
    citations = ""
    if source_documents:
        citations = "\n\nSources:\n" + "\n".join(
            f"- {doc.get('title', 'Unknown')} ({doc.get('filename', 'Unknown')})"
            for doc in source_documents[:5]
        )

    system_prompt = """You are InnoSynth.ai, an enterprise knowledge synthesis assistant.

Your role is to:
1. Answer questions accurately based ONLY on the provided context
2. If the context doesn't contain enough information, say so clearly
3. Cite sources using [Source N] notation when possible
4. Be concise but thorough
5. Use a professional, helpful tone
6. Highlight key insights"""

    prompt = f"""Based on the following context, please answer this question:

Question: {query}

Context:
{context}
{citations}

Please provide a clear, accurate answer based on the context above. Cite sources when possible."""

    result = await generate(
        prompt=prompt,
        system_prompt=system_prompt,
        temperature=0.3,  # Lower temperature for factual answers
        max_tokens=1500,
        force_local=force_local
    )

    if result.get("success"):
        result["query"] = query
        result["context_used"] = len(context_chunks)

    return result


# ============================================================================
# Legacy API Compatibility
# ============================================================================

# Import schemas for backwards compatibility
try:
    from app.schemas import Source

    async def synthesize_answer(query: str, sources: list) -> str:
        """
        Legacy function for backwards compatibility.

        Args:
            query: User's question
            sources: List of Source objects

        Returns:
            Synthesized answer string
        """
        # Convert sources to context chunks
        context_chunks = []
        source_docs = []

        for i, source in enumerate(sources, 1):
            context_chunks.append(f"[Source {i}]\nTitle: {source.title}\nExcerpt: {source.excerpt}")
            source_docs.append({
                "title": source.title,
                "filename": source.url or "N/A"
            })

        result = await synthesize_knowledge(query, context_chunks, source_docs)

        if result.get("success"):
            return result["response"]
        else:
            raise Exception(f"Failed to synthesize answer: {result.get('message', 'Unknown error')}")

    def build_context_from_sources(sources: list) -> str:
        """Legacy function for building context."""
        context_parts = []

        for i, source in enumerate(sources, 1):
            context_parts.append(f"""[Source {i}]
Title: {source.title}
URL: {source.url or 'N/A'}
Excerpt: {source.excerpt}
Relevance: {source.relevance_score:.2f}
---""")

        return "\n\n".join(context_parts)

except ImportError:
    pass  # Source schema not available, skip legacy functions


async def generate_follow_up_questions(query: str, answer: str) -> list[str]:
    """
    Generate follow-up questions based on query and answer.

    Uses AI to suggest relevant follow-up questions that help users
    explore the topic deeper or investigate related aspects.

    Args:
        query: Original user question
        answer: Synthesized answer

    Returns:
        List of 3 follow-up questions
    """
    if not query or not answer:
        return []

    system_prompt = """You are InnoSynth.ai's research assistant. Based on the question and answer provided,
generate exactly 3 follow-up questions that would help the user explore deeper.

Guidelines:
1. Questions should be specific and actionable
2. They should explore related aspects or go deeper into details mentioned
3. They should be answerable from a knowledge base (not personal questions)
4. Keep each question under 100 characters

Return ONLY the 3 questions, one per line. No numbering, no explanations."""

    prompt = f"""Original Question: {query}

Answer: {answer[:1500]}

Generate 3 follow-up questions:"""

    try:
        result = await generate(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.7,
            max_tokens=300
        )

        if result.get("success") and result.get("response"):
            # Parse response into list of questions
            lines = result["response"].strip().split("\n")
            questions = []
            for line in lines:
                # Clean up the line
                cleaned = line.strip()
                # Remove common prefixes like "1.", "- ", etc.
                cleaned = cleaned.lstrip("0123456789.-) ")
                if cleaned and len(cleaned) > 10 and cleaned.endswith("?"):
                    questions.append(cleaned)
                elif cleaned and len(cleaned) > 10:
                    # Add question mark if missing
                    questions.append(cleaned + "?")

            return questions[:3]  # Return max 3 questions

        return []

    except Exception as e:
        logger.warning(f"Failed to generate follow-up questions: {e}")
        return []


# ============================================================================
# Status and Info
# ============================================================================

async def get_status() -> dict[str, Any]:
    """Get status of all synthesis providers."""
    from app.services import ollama_service

    claude_available = _get_anthropic_api_key() is not None
    ollama_available = await ollama_service.is_available()
    ollama_models = await ollama_service.get_available_models() if ollama_available else []

    return {
        "current_provider": get_current_provider(),
        "claude": {
            "available": claude_available,
            "model": "claude-3-haiku-20240307" if claude_available else None
        },
        "ollama": {
            "available": ollama_available,
            "models": ollama_models
        }
    }
