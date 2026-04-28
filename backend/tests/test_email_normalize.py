"""
Pure unit tests for app.utils.email_normalize.

Covers:
- normalize_email: case folding, +suffix stripping, whitespace trimming,
  Unicode invisible removal, empty/None/no-@ defensive cases
- email_hash: determinism, sha256 hex, length
"""

import hashlib

import pytest

from app.utils.email_normalize import email_hash, normalize_email


class TestNormalizeEmail:
    """Tests for normalize_email()."""

    # -------------------------------------------------------------------------
    # Happy path
    # -------------------------------------------------------------------------

    def test_lowercases_address(self):
        assert normalize_email("Jane@Acme.COM") == "jane@acme.com"

    def test_strips_plus_suffix(self):
        assert normalize_email("jane+sales@acme.com") == "jane@acme.com"

    def test_strips_multiple_plus_segments(self):
        """Only the first + is the suffix delimiter; 'jane+sales+notify' -> 'jane'."""
        assert normalize_email("Jane+sales+notify@Acme.COM") == "jane@acme.com"

    def test_strips_surrounding_whitespace(self):
        assert normalize_email("  jane@acme.com  ") == "jane@acme.com"

    def test_strips_zero_width_space(self):
        """U+200B zero-width space embedded inside the local part."""
        raw = "jane​@acme.com"
        assert normalize_email(raw) == "jane@acme.com"

    def test_combined_case_and_plus_and_whitespace(self):
        assert normalize_email("  Jane+Sales@Acme.COM  ") == "jane@acme.com"

    # -------------------------------------------------------------------------
    # Edge cases
    # -------------------------------------------------------------------------

    def test_empty_string_returns_empty(self):
        assert normalize_email("") == ""

    def test_none_returns_empty_not_crash(self):
        assert normalize_email(None) == ""

    def test_no_at_sign_returns_lowercased_stripped(self):
        """Defensive: no crash, return the lowercased stripped value."""
        result = normalize_email("notanemail")
        assert result == "notanemail"

    def test_no_at_sign_uppercase_is_lowercased(self):
        result = normalize_email("NOTANEMAIL")
        assert result == "notanemail"

    def test_whitespace_only_returns_empty(self):
        assert normalize_email("   ") == ""

    def test_plus_only_local_returns_domain_prefixed(self):
        """'+sales@acme.com' strips the whole local part; emit '@domain'."""
        result = normalize_email("+sales@acme.com")
        assert result == "@acme.com"

    def test_already_normalized_is_idempotent(self):
        addr = "jane@acme.com"
        assert normalize_email(addr) == addr

    def test_zero_width_joiner_stripped(self):
        """U+200D zero-width joiner."""
        raw = "ja‍ne@acme.com"
        assert normalize_email(raw) == "jane@acme.com"

    def test_bom_stripped(self):
        """BOM at start of string."""
        raw = "﻿Jane@acme.com"
        assert normalize_email(raw) == "jane@acme.com"

    def test_unicode_format_char_stripped(self):
        """Cf-category character U+00AD (soft hyphen) embedded."""
        raw = "jan­e@acme.com"
        assert normalize_email(raw) == "jane@acme.com"


class TestEmailHash:
    """Tests for email_hash()."""

    def test_deterministic(self):
        h1 = email_hash("jane@acme.com")
        h2 = email_hash("jane@acme.com")
        assert h1 == h2

    def test_is_sha256_hex(self):
        result = email_hash("jane@acme.com")
        expected = hashlib.sha256("jane@acme.com".encode("utf-8")).hexdigest()
        assert result == expected

    def test_64_chars(self):
        assert len(email_hash("jane@acme.com")) == 64

    def test_normalizes_before_hashing(self):
        """'Jane+Sales@Acme.COM' and 'jane@acme.com' must produce the same hash."""
        assert email_hash("Jane+Sales@Acme.COM") == email_hash("jane@acme.com")

    def test_empty_input_returns_empty_string(self):
        """Empty -> '' (not sha256(''))."""
        assert email_hash("") == ""

    def test_none_returns_empty_string(self):
        assert email_hash(None) == ""

    def test_different_emails_differ(self):
        assert email_hash("alice@acme.com") != email_hash("bob@acme.com")

    def test_hash_is_hex_chars_only(self):
        result = email_hash("jane@acme.com")
        assert all(c in "0123456789abcdef" for c in result)
