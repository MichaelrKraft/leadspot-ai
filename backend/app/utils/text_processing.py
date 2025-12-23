"""
Text Processing Utilities

Provides text processing functions for document ingestion:
- Token counting with tiktoken
- Text normalization and cleaning
- Language detection
- Sentence boundary detection
"""

import re
import unicodedata

import tiktoken
from langdetect import LangDetectException, detect


class TextProcessor:
    """Utility class for text processing operations."""

    def __init__(self, encoding_name: str = "cl100k_base"):
        """
        Initialize text processor.

        Args:
            encoding_name: Tiktoken encoding to use (cl100k_base for GPT-4/3.5)
        """
        self.encoding = tiktoken.get_encoding(encoding_name)

        # Sentence boundary patterns
        self.sentence_endings = re.compile(r'[.!?]+[\s\n]+')

    def count_tokens(self, text: str) -> int:
        """
        Count tokens in text using tiktoken.

        Args:
            text: Text to count tokens in

        Returns:
            Number of tokens
        """
        if not text:
            return 0
        return len(self.encoding.encode(text))

    def normalize_text(self, text: str) -> str:
        """
        Normalize text for processing.

        Operations:
        - Unicode normalization (NFKC)
        - Whitespace normalization
        - Remove control characters
        - Preserve paragraph breaks

        Args:
            text: Text to normalize

        Returns:
            Normalized text
        """
        if not text:
            return ""

        # Unicode normalization
        text = unicodedata.normalize('NFKC', text)

        # Remove control characters except newlines and tabs
        text = ''.join(
            char for char in text
            if unicodedata.category(char)[0] != 'C' or char in '\n\t'
        )

        # Normalize whitespace while preserving paragraph breaks
        # Replace multiple spaces with single space
        text = re.sub(r' +', ' ', text)

        # Preserve double newlines (paragraph breaks)
        text = re.sub(r'\n\n+', '\n\n', text)

        # Replace single newlines with spaces
        text = re.sub(r'(?<!\n)\n(?!\n)', ' ', text)

        # Replace tabs with spaces
        text = text.replace('\t', ' ')

        # Trim whitespace from each line
        lines = [line.strip() for line in text.split('\n')]
        text = '\n'.join(lines)

        return text.strip()

    def detect_language(self, text: str) -> str | None:
        """
        Detect the language of the text.

        Args:
            text: Text to analyze

        Returns:
            ISO 639-1 language code (e.g., 'en', 'es') or None if detection fails
        """
        if not text or len(text.strip()) < 20:
            return None

        try:
            return detect(text)
        except LangDetectException:
            return None

    def split_sentences(self, text: str) -> list[str]:
        """
        Split text into sentences using simple regex.

        Note: For better sentence boundary detection, consider using
        spaCy or NLTK for production use.

        Args:
            text: Text to split

        Returns:
            List of sentences
        """
        if not text:
            return []

        # Split on sentence boundaries
        sentences = self.sentence_endings.split(text)

        # Filter empty sentences and strip whitespace
        sentences = [s.strip() for s in sentences if s.strip()]

        return sentences

    def find_sentence_boundaries(self, text: str) -> list[int]:
        """
        Find character positions of sentence boundaries.

        Args:
            text: Text to analyze

        Returns:
            List of character positions where sentences end
        """
        boundaries = [0]  # Start of text

        for match in self.sentence_endings.finditer(text):
            boundaries.append(match.end())

        if boundaries[-1] != len(text):
            boundaries.append(len(text))  # End of text

        return boundaries

    def chunk_by_tokens(
        self,
        text: str,
        max_tokens: int = 512,
        overlap_tokens: int = 50
    ) -> list[str]:
        """
        Split text into chunks by token count.

        This is a simple token-based chunker. For semantic chunking,
        use DocumentChunker instead.

        Args:
            text: Text to chunk
            max_tokens: Maximum tokens per chunk
            overlap_tokens: Number of overlapping tokens between chunks

        Returns:
            List of text chunks
        """
        if not text:
            return []

        # Encode text to tokens
        tokens = self.encoding.encode(text)

        if len(tokens) <= max_tokens:
            return [text]

        chunks = []
        start = 0

        while start < len(tokens):
            # Get chunk of tokens
            end = min(start + max_tokens, len(tokens))
            chunk_tokens = tokens[start:end]

            # Decode back to text
            chunk_text = self.encoding.decode(chunk_tokens)
            chunks.append(chunk_text)

            # Move start position (with overlap)
            start = end - overlap_tokens

            # Prevent infinite loop on small overlaps
            if start <= end - max_tokens:
                start = end

        return chunks

    def clean_code_blocks(self, text: str) -> str:
        """
        Clean markdown code blocks for better text processing.

        Args:
            text: Text potentially containing code blocks

        Returns:
            Text with code blocks cleaned
        """
        # Remove code block markers but keep content
        text = re.sub(r'```[\w]*\n', '\n', text)
        text = re.sub(r'```', '', text)

        return text

    def extract_urls(self, text: str) -> list[str]:
        """
        Extract URLs from text.

        Args:
            text: Text to extract URLs from

        Returns:
            List of URLs found
        """
        url_pattern = re.compile(
            r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+'
        )
        return url_pattern.findall(text)

    def remove_urls(self, text: str) -> str:
        """
        Remove URLs from text.

        Args:
            text: Text to remove URLs from

        Returns:
            Text with URLs removed
        """
        url_pattern = re.compile(
            r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+'
        )
        return url_pattern.sub('', text)


# Singleton instance for convenient access
text_processor = TextProcessor()
