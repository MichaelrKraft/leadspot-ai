"""
Metadata Extraction Service

Extracts and enriches document metadata:
- Title, author, dates
- Tags and categories
- Document relationships
- AI-generated summaries
"""

import logging
import re
from datetime import datetime
from typing import Any

import openai

from app.utils.text_processing import text_processor

logger = logging.getLogger(__name__)


class MetadataExtractor:
    """Service for extracting and enriching document metadata."""

    def __init__(self, openai_api_key: str | None = None):
        """
        Initialize metadata extractor.

        Args:
            openai_api_key: OpenAI API key for AI-powered extraction
        """
        self.openai_client = None
        if openai_api_key:
            self.openai_client = openai.AsyncOpenAI(api_key=openai_api_key)

    async def extract_metadata(
        self,
        text: str,
        file_metadata: dict[str, Any],
        use_ai: bool = True
    ) -> dict[str, Any]:
        """
        Extract comprehensive metadata from document.

        Args:
            text: Document text
            file_metadata: Metadata from file extraction
            use_ai: Whether to use AI for enhanced extraction

        Returns:
            Dictionary of metadata
        """
        metadata = {
            'extracted_at': datetime.utcnow().isoformat(),
            **file_metadata
        }

        # Basic extraction
        metadata.update(await self._extract_basic_metadata(text, file_metadata))

        # AI-powered extraction (if enabled and API key available)
        if use_ai and self.openai_client:
            try:
                ai_metadata = await self._extract_ai_metadata(text)
                metadata.update(ai_metadata)
            except Exception as e:
                logger.warning(f"AI metadata extraction failed: {e!s}")

        return metadata

    async def _extract_basic_metadata(
        self,
        text: str,
        file_metadata: dict[str, Any]
    ) -> dict[str, Any]:
        """Extract basic metadata without AI."""
        metadata = {}

        # Title extraction (if not in file metadata)
        if not file_metadata.get('title'):
            title = self._extract_title(text)
            if title:
                metadata['title'] = title

        # Language detection
        language = text_processor.detect_language(text)
        if language:
            metadata['language'] = language

        # Text statistics
        metadata['character_count'] = len(text)
        metadata['word_count'] = len(text.split())
        metadata['token_count'] = text_processor.count_tokens(text)

        # Extract dates mentioned in text
        dates = self._extract_dates(text)
        if dates:
            metadata['mentioned_dates'] = dates[:5]  # Limit to 5

        # Extract URLs
        urls = text_processor.extract_urls(text)
        if urls:
            metadata['urls'] = urls[:10]  # Limit to 10

        return metadata

    def _extract_title(self, text: str) -> str | None:
        """
        Extract title from text.

        Heuristics:
        1. First line if short (< 100 chars)
        2. First markdown H1
        3. First sentence if short
        """
        lines = text.strip().split('\n')
        if not lines:
            return None

        # Check first line
        first_line = lines[0].strip()

        # Check for markdown H1
        if first_line.startswith('#'):
            return first_line.lstrip('#').strip()

        # If first line is short, use it
        if len(first_line) < 100 and first_line:
            return first_line

        # Try first sentence
        sentences = text_processor.split_sentences(text)
        if sentences and len(sentences[0]) < 100:
            return sentences[0]

        return None

    def _extract_dates(self, text: str) -> list[str]:
        """Extract date mentions from text."""
        # Simple date patterns (YYYY-MM-DD, MM/DD/YYYY, etc.)
        date_patterns = [
            r'\d{4}-\d{2}-\d{2}',  # YYYY-MM-DD
            r'\d{2}/\d{2}/\d{4}',  # MM/DD/YYYY
            r'\d{2}-\d{2}-\d{4}',  # MM-DD-YYYY
            r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}',  # Month DD, YYYY
        ]

        dates = []
        for pattern in date_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            dates.extend(matches)

        return list(set(dates))  # Remove duplicates

    async def _extract_ai_metadata(self, text: str) -> dict[str, Any]:
        """
        Use AI to extract enhanced metadata.

        Extracts:
        - Summary
        - Key topics
        - Document type
        - Key entities (people, organizations, locations)
        """
        # Truncate text for API call (max ~2000 tokens)
        text_sample = text[:8000]  # Roughly 2000 tokens

        prompt = f"""Analyze the following document excerpt and extract metadata in JSON format:

Document:
{text_sample}

Extract the following:
1. summary: A 2-3 sentence summary of the document
2. topics: List of 3-5 main topics/themes
3. document_type: Type of document (e.g., report, article, memo, research paper)
4. key_entities: Important people, organizations, or concepts mentioned
5. sentiment: Overall sentiment (positive, negative, neutral, mixed)

Return ONLY a JSON object with these fields."""

        try:
            response = await self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a document analysis expert. Extract metadata in JSON format."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=500,
                response_format={"type": "json_object"}
            )

            # Parse JSON response
            import json
            metadata = json.loads(response.choices[0].message.content)

            # Clean up and validate
            ai_metadata = {
                'ai_summary': metadata.get('summary', ''),
                'ai_topics': metadata.get('topics', [])[:5],  # Limit to 5
                'document_type': metadata.get('document_type', ''),
                'key_entities': metadata.get('key_entities', [])[:10],  # Limit to 10
                'sentiment': metadata.get('sentiment', 'neutral'),
                'ai_extracted': True
            }

            return ai_metadata

        except Exception as e:
            logger.error(f"AI metadata extraction error: {e!s}", exc_info=True)
            return {'ai_extracted': False, 'ai_error': str(e)}

    async def generate_summary(
        self,
        text: str,
        max_length: int = 200
    ) -> str:
        """
        Generate a summary of the document.

        Args:
            text: Document text
            max_length: Maximum summary length in words

        Returns:
            Summary text
        """
        if not self.openai_client:
            # Fallback: Return first N words
            words = text.split()[:max_length]
            return ' '.join(words) + '...'

        # Truncate text for API call
        text_sample = text[:8000]

        prompt = f"""Summarize the following document in {max_length} words or less:

{text_sample}

Summary:"""

        try:
            response = await self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a concise summarization expert."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=max_length * 2  # Tokens roughly 1.5x words
            )

            summary = response.choices[0].message.content.strip()
            return summary

        except Exception as e:
            logger.error(f"Summary generation error: {e!s}")
            # Fallback
            words = text.split()[:max_length]
            return ' '.join(words) + '...'

    def extract_author_info(
        self,
        text: str,
        file_metadata: dict[str, Any]
    ) -> dict[str, Any] | None:
        """
        Extract author information.

        Args:
            text: Document text
            file_metadata: File metadata that may contain author

        Returns:
            Author information or None
        """
        author_name = file_metadata.get('author', '').strip()

        if not author_name:
            # Try to find author in text
            # Look for "By [Name]" or "Author: [Name]"
            patterns = [
                r'(?:By|Author):\s*([A-Z][a-z]+(?: [A-Z][a-z]+)+)',
                r'Written by\s+([A-Z][a-z]+(?: [A-Z][a-z]+)+)',
            ]

            for pattern in patterns:
                match = re.search(pattern, text[:1000])  # Check first 1000 chars
                if match:
                    author_name = match.group(1)
                    break

        if author_name:
            return {
                'name': author_name,
                'source': 'file_metadata' if file_metadata.get('author') else 'text_extraction'
            }

        return None
