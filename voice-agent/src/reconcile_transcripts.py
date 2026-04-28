"""
Reconciliation job: sweeps ./data/transcripts/ for any transcript JSON files
that failed to POST during the call (e.g., dashboard was unreachable), and
retries them.

Run as a Railway cron job every 15 minutes:
  python -m src.reconcile_transcripts

Environment variables:
  DASHBOARD_URL       Base URL of the Next.js dashboard (default: http://localhost:3005)
  VOICE_AGENT_API_KEY Internal API key sent in x-api-key header
  AGENT_DATA_DIR      Root data directory (default: ./data)
"""

import asyncio
import json
import logging
import os
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)

DASHBOARD_URL: str = os.getenv("DASHBOARD_URL", "http://localhost:3005")
VOICE_AGENT_API_KEY: str = os.getenv("VOICE_AGENT_API_KEY", "")
TRANSCRIPTS_DIR: Path = (
    Path(os.getenv("AGENT_DATA_DIR", "./data")) / "transcripts"
)


async def _post_transcript(
    client: httpx.AsyncClient,
    call_id: str,
    transcript: list,
    full_text: str,
) -> int:
    """POST a single transcript to the finalize endpoint. Returns HTTP status code."""
    resp = await client.post(
        f"{DASHBOARD_URL}/api/voice/calls/{call_id}/finalize",
        json={"transcript": transcript, "fullText": full_text},
        headers={"x-api-key": VOICE_AGENT_API_KEY},
    )
    return resp.status_code


async def reconcile() -> None:
    if not TRANSCRIPTS_DIR.exists():
        logger.info("No transcripts directory found — nothing to reconcile.")
        return

    pending = list(TRANSCRIPTS_DIR.glob("*.json"))
    if not pending:
        logger.info("No pending transcripts to reconcile.")
        return

    logger.info("Found %d pending transcript(s) to reconcile.", len(pending))

    async with httpx.AsyncClient(timeout=30.0) as client:
        for path in pending:
            call_id = path.stem
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                logger.error(
                    "Corrupt transcript file %s — removing.", path
                )
                path.unlink(missing_ok=True)
                continue
            except OSError as exc:
                logger.error("Could not read %s: %s", path, exc)
                continue

            transcript = data.get("transcript", [])
            full_text = data.get("fullText", "")

            try:
                status = await _post_transcript(
                    client, call_id, transcript, full_text
                )
            except httpx.TimeoutException:
                logger.warning(
                    "Timeout posting %s — will retry next cycle.", call_id
                )
                continue
            except httpx.RequestError as exc:
                logger.error(
                    "Network error reconciling %s: %s", call_id, exc
                )
                continue

            if status in (200, 201):
                path.unlink(missing_ok=True)
                logger.info("Reconciled and deleted %s.json", call_id)
            elif status == 404:
                # Call record doesn't exist in the dashboard — orphan file, clean up
                path.unlink(missing_ok=True)
                logger.warning(
                    "Call %s not found in dashboard — removed orphan transcript.",
                    call_id,
                )
            elif status == 409:
                # Already finalized (idempotency) — safe to remove the local copy
                path.unlink(missing_ok=True)
                logger.info(
                    "Call %s already finalized — removed local copy.", call_id
                )
            else:
                logger.warning(
                    "Failed to reconcile %s: HTTP %d — will retry next cycle.",
                    call_id,
                    status,
                )


if __name__ == "__main__":
    asyncio.run(reconcile())
