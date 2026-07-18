"""
Ollama LLM Service - Local AI inference without API keys

This service provides local LLM capabilities using Ollama.
If Ollama is not available, it provides a graceful fallback.

Requires Ollama to be installed and running:
  curl -fsSL https://ollama.ai/install.sh | sh
  ollama pull llama3
"""

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# Ollama API endpoint (local)
OLLAMA_BASE_URL = "http://localhost:11434"
DEFAULT_MODEL = "llama3.2"  # Good balance of quality and speed
FALLBACK_MODELS = ["llama3.2", "llama3.1", "llama3", "mistral", "llama2"]

# Connection timeout (Ollama might need time to load model)
TIMEOUT = httpx.Timeout(
    connect=5.0,
    read=120.0,  # LLM responses can take time
    write=5.0,
    pool=5.0
)


async def is_available() -> bool:
    """Check if Ollama is running and accessible."""
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(2.0)) as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            return response.status_code == 200
    except Exception:
        return False


async def get_available_models() -> list:
    """Get list of available models from Ollama."""
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if response.status_code == 200:
                data = response.json()
                return [model["name"] for model in data.get("models", [])]
    except Exception as e:
        logger.debug(f"Could not get Ollama models: {e}")
    return []


async def get_best_available_model() -> str | None:
    """Get the best available model from the preferred list."""
    available = await get_available_models()
    if not available:
        return None

    # Check preferred models in order
    for preferred in FALLBACK_MODELS:
        for model in available:
            if model.startswith(preferred):
                return model

    # Return first available if no preferred found
    return available[0] if available else None


async def generate(
    prompt: str,
    model: str | None = None,
    system_prompt: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 2048
) -> dict[str, Any]:
    """
    Generate text using Ollama.

    Args:
        prompt: The user prompt
        model: Model to use (auto-detects if not specified)
        system_prompt: Optional system prompt
        temperature: Sampling temperature (0.0-1.0)
        max_tokens: Maximum tokens to generate

    Returns:
        Dictionary with response and metadata
    """
    # Check availability
    if not await is_available():
        return {
            "success": False,
            "error": "ollama_not_available",
            "message": "Ollama is not running. Install and start Ollama to enable local AI.",
            "response": None
        }

    # Get model
    if not model:
        model = await get_best_available_model()
        if not model:
            return {
                "success": False,
                "error": "no_model_available",
                "message": "No Ollama models available. Run: ollama pull llama3.2",
                "response": None
            }

    # Build request
    request_data = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens
        }
    }

    if system_prompt:
        request_data["system"] = system_prompt

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json=request_data
            )

            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "response": data.get("response", ""),
                    "model": model,
                    "total_duration_ms": data.get("total_duration", 0) // 1_000_000,
                    "tokens_evaluated": data.get("prompt_eval_count", 0),
                    "tokens_generated": data.get("eval_count", 0)
                }
            else:
                return {
                    "success": False,
                    "error": "api_error",
                    "message": f"Ollama returned status {response.status_code}",
                    "response": None
                }

    except httpx.TimeoutException:
        return {
            "success": False,
            "error": "timeout",
            "message": "Request timed out. The model might be loading or the prompt is too long.",
            "response": None
        }
    except Exception as e:
        logger.error(f"Ollama generate error: {e}")
        return {
            "success": False,
            "error": "unknown",
            "message": str(e),
            "response": None
        }


async def chat(
    messages: list,
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int = 2048
) -> dict[str, Any]:
    """
    Chat completion using Ollama.

    Args:
        messages: List of {"role": "user/assistant/system", "content": "..."}
        model: Model to use
        temperature: Sampling temperature
        max_tokens: Maximum tokens to generate

    Returns:
        Dictionary with response and metadata
    """
    # Check availability
    if not await is_available():
        return {
            "success": False,
            "error": "ollama_not_available",
            "message": "Ollama is not running. Install and start Ollama to enable local AI.",
            "response": None
        }

    # Get model
    if not model:
        model = await get_best_available_model()
        if not model:
            return {
                "success": False,
                "error": "no_model_available",
                "message": "No Ollama models available. Run: ollama pull llama3.2",
                "response": None
            }

    request_data = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens
        }
    }

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/chat",
                json=request_data
            )

            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "response": data.get("message", {}).get("content", ""),
                    "model": model,
                    "total_duration_ms": data.get("total_duration", 0) // 1_000_000,
                    "tokens_evaluated": data.get("prompt_eval_count", 0),
                    "tokens_generated": data.get("eval_count", 0)
                }
            else:
                return {
                    "success": False,
                    "error": "api_error",
                    "message": f"Ollama returned status {response.status_code}",
                    "response": None
                }

    except httpx.TimeoutException:
        return {
            "success": False,
            "error": "timeout",
            "message": "Request timed out.",
            "response": None
        }
    except Exception as e:
        logger.error(f"Ollama chat error: {e}")
        return {
            "success": False,
            "error": "unknown",
            "message": str(e),
            "response": None
        }


def get_service_info() -> dict:
    """Get information about the Ollama service."""
    return {
        "provider": "ollama (local)",
        "base_url": OLLAMA_BASE_URL,
        "default_model": DEFAULT_MODEL,
        "requires_api_key": False,
        "installation": "curl -fsSL https://ollama.ai/install.sh | sh && ollama pull llama3.2"
    }
