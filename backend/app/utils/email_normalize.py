"""Email normalization + hashing for Ghostlog matching.

Per plan §2.3 ("Email normalization, v1, not v2"):
- Lowercase the entire address
- Strip `+suffix` from local part (e.g. jane+sales@acme.com -> jane@acme.com)
- Trim surrounding whitespace, strip Unicode invisibles
- Hash the normalized email (sha256) -> email_hash used for matching

These are pure functions. They never touch the DB.
"""

import hashlib
import unicodedata
from typing import Optional


# Unicode invisible categories: Cf (format), Cc (control), Zl/Zp (line/paragraph
# separators). We strip these BEFORE lowering so case-folding is on a clean
# string. Also explicitly remove the BOM and zero-width joiner/non-joiner.
_INVISIBLE_CATEGORIES = {"Cf", "Cc", "Zl", "Zp"}
_EXPLICIT_INVISIBLE = {"​", "‌", "‍", "﻿"}


def _strip_invisibles(s: str) -> str:
    out = []
    for ch in s:
        if ch in _EXPLICIT_INVISIBLE:
            continue
        if unicodedata.category(ch) in _INVISIBLE_CATEGORIES:
            continue
        out.append(ch)
    return "".join(out)


def normalize_email(raw: Optional[str]) -> str:
    """Normalize an email for hashing/matching.

    Defensive contract:
    - None / empty -> ""
    - No "@" -> return lowercased + stripped (don't crash, don't pretend to parse)
    """
    if not raw:
        return ""

    # NFKC + invisible strip + trim + lowercase.
    cleaned = unicodedata.normalize("NFKC", raw)
    cleaned = _strip_invisibles(cleaned).strip().lower()

    if not cleaned:
        return ""

    if "@" not in cleaned:
        # Defensive: caller passed something that isn't an email. Don't fabricate
        # an @ — return what we have. Callers that require validity should
        # validate BEFORE normalizing.
        return cleaned

    local, _, domain = cleaned.rpartition("@")
    if not local:
        return cleaned

    # Strip +suffix from local part. "jane+sales" -> "jane", "+only" -> "".
    plus_idx = local.find("+")
    if plus_idx >= 0:
        local = local[:plus_idx]

    if not local:
        # All-suffix local (edge case "+sales@acme.com"). Preserve domain so the
        # hash doesn't collide with empty inputs; emit a recognizable placeholder.
        return f"@{domain}"

    return f"{local}@{domain}"


def email_hash(raw: Optional[str]) -> str:
    """sha256 of the normalized email, hex-encoded.

    Empty/None inputs -> "" (not the sha256 of empty string — distinguishable
    from a real hash by length so callers can detect "no input").
    """
    normalized = normalize_email(raw)
    if not normalized:
        return ""
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()
