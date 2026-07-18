"""
Claude AI Service - Cloud synthesis using Anthropic's Claude API

Provides high-quality AI synthesis using Claude models.
Falls back to local Ollama if API key is not configured.

Requires: ANTHROPIC_API_KEY environment variable
"""

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

# Claude model configuration
DEFAULT_MODEL = "claude-3-haiku-20240307"  # Fast and cost-effective
PREMIUM_MODEL = "claude-3-sonnet-20240229"  # Better quality (Claude 3 Sonnet)
MAX_TOKENS = 4096


def _get_api_key() -> str | None:
    """Get Anthropic API key from settings or environment."""
    try:
        from app.config import settings
        key = getattr(settings, 'ANTHROPIC_API_KEY', None)
    except ImportError:
        key = None

    if not key:
        key = os.getenv('ANTHROPIC_API_KEY')

    return key if key and key.strip() else None


def is_available() -> bool:
    """Check if Claude API is available (API key configured)."""
    return _get_api_key() is not None


async def generate(
    prompt: str,
    system_prompt: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = MAX_TOKENS,
    model: str | None = None
) -> dict[str, Any]:
    """
    Generate text using Claude API.

    Args:
        prompt: The user prompt
        system_prompt: Optional system instructions
        temperature: Sampling temperature (0.0-1.0)
        max_tokens: Maximum tokens to generate
        model: Model to use (defaults to haiku)

    Returns:
        Dictionary with response and metadata
    """
    api_key = _get_api_key()
    if not api_key:
        return {
            "success": False,
            "error": "api_key_not_configured",
            "message": "Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable.",
            "response": None
        }

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

        model = model or DEFAULT_MODEL

        # Build message
        message_params = {
            "model": model,
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
            "model": model,
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
            "stop_reason": response.stop_reason
        }

    except anthropic.APIConnectionError as e:
        logger.error(f"Claude API connection error: {e}")
        return {
            "success": False,
            "error": "connection_error",
            "message": "Could not connect to Anthropic API",
            "response": None
        }
    except anthropic.RateLimitError as e:
        logger.error(f"Claude API rate limit: {e}")
        return {
            "success": False,
            "error": "rate_limit",
            "message": "Rate limit exceeded. Please try again later.",
            "response": None
        }
    except anthropic.APIStatusError as e:
        logger.error(f"Claude API error: {e}")
        return {
            "success": False,
            "error": "api_error",
            "message": str(e),
            "response": None
        }
    except Exception as e:
        logger.error(f"Claude generate error: {e}")
        return {
            "success": False,
            "error": "unknown",
            "message": str(e),
            "response": None
        }


async def chat(
    messages: list[dict[str, str]],
    system_prompt: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = MAX_TOKENS,
    model: str | None = None
) -> dict[str, Any]:
    """
    Chat completion using Claude API.

    Args:
        messages: List of {"role": "user/assistant", "content": "..."}
        system_prompt: Optional system instructions
        temperature: Sampling temperature
        max_tokens: Maximum tokens to generate
        model: Model to use

    Returns:
        Dictionary with response and metadata
    """
    api_key = _get_api_key()
    if not api_key:
        return {
            "success": False,
            "error": "api_key_not_configured",
            "message": "Anthropic API key not configured",
            "response": None
        }

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

        model = model or DEFAULT_MODEL

        # Convert messages format if needed (Claude uses "user" and "assistant" only)
        claude_messages = []
        for msg in messages:
            role = msg.get("role", "user")
            if role == "system":
                # System messages go in system parameter
                if not system_prompt:
                    system_prompt = msg.get("content", "")
                continue
            claude_messages.append({
                "role": role if role in ["user", "assistant"] else "user",
                "content": msg.get("content", "")
            })

        message_params = {
            "model": model,
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
            "model": model,
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
            "stop_reason": response.stop_reason
        }

    except Exception as e:
        logger.error(f"Claude chat error: {e}")
        return {
            "success": False,
            "error": "unknown",
            "message": str(e),
            "response": None
        }


async def synthesize_knowledge(
    query: str,
    context_chunks: list[str],
    source_documents: list[dict] | None = None
) -> dict[str, Any]:
    """
    Synthesize an answer from context chunks using Claude.

    This is the main RAG synthesis function.

    Args:
        query: User's question
        context_chunks: Relevant text chunks from documents
        source_documents: Optional metadata about source documents

    Returns:
        Dictionary with synthesized answer and metadata
    """
    if not context_chunks:
        return {
            "success": False,
            "error": "no_context",
            "message": "No relevant context found to answer the question",
            "response": None
        }

    # Build context string
    context = "\n\n---\n\n".join(context_chunks[:5])  # Limit to top 5 chunks

    # Build source citations if available
    citations = ""
    if source_documents:
        citations = "\n\nSources:\n" + "\n".join(
            f"- {doc.get('title', 'Unknown')} ({doc.get('filename', 'Unknown')})"
            for doc in source_documents[:5]
        )

    system_prompt = """You are a knowledge synthesis assistant. Your role is to:
1. Answer questions accurately based ONLY on the provided context
2. If the context doesn't contain enough information, say so clearly
3. Cite sources when possible
4. Be concise but thorough
5. Use a professional, helpful tone"""

    prompt = f"""Based on the following context, please answer this question:

Question: {query}

Context:
{context}
{citations}

Please provide a clear, accurate answer based on the context above. If the context doesn't fully answer the question, explain what information is missing."""

    result = await generate(
        prompt=prompt,
        system_prompt=system_prompt,
        temperature=0.3,  # Lower temperature for factual answers
        max_tokens=1500
    )

    if result["success"]:
        result["query"] = query
        result["context_used"] = len(context_chunks)

    return result


def get_service_info() -> dict:
    """Get information about the Claude service."""
    return {
        "provider": "anthropic",
        "default_model": DEFAULT_MODEL,
        "premium_model": PREMIUM_MODEL,
        "requires_api_key": True,
        "api_key_configured": is_available(),
        "max_tokens": MAX_TOKENS
    }
