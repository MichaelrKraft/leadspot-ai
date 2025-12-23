"""
Document Chunking Service

Splits documents into semantic chunks for embedding:
- Sentence-boundary aware splitting
- Token limit enforcement (max 512 tokens)
- Sliding window with overlap
- Preserves document structure markers
"""

import logging
from typing import Any

from app.utils.text_processing import text_processor

logger = logging.getLogger(__name__)


class DocumentChunk:
    """Represents a single chunk of a document."""

    def __init__(
        self,
        text: str,
        chunk_index: int,
        token_count: int,
        metadata: dict[str, Any]
    ):
        self.text = text
        self.chunk_index = chunk_index
        self.token_count = token_count
        self.metadata = metadata

    def to_dict(self) -> dict[str, Any]:
        """Convert chunk to dictionary."""
        return {
            'text': self.text,
            'chunk_index': self.chunk_index,
            'token_count': self.token_count,
            'metadata': self.metadata
        }


class DocumentChunker:
    """Service for chunking documents into semantic pieces."""

    def __init__(
        self,
        max_tokens: int = 512,
        overlap_tokens: int = 50,
        min_chunk_tokens: int = 50
    ):
        """
        Initialize document chunker.

        Args:
            max_tokens: Maximum tokens per chunk
            overlap_tokens: Number of overlapping tokens between chunks
            min_chunk_tokens: Minimum tokens for a valid chunk
        """
        self.max_tokens = max_tokens
        self.overlap_tokens = overlap_tokens
        self.min_chunk_tokens = min_chunk_tokens

    async def chunk_document(
        self,
        text: str,
        metadata: dict[str, Any]
    ) -> list[DocumentChunk]:
        """
        Chunk a document into semantic pieces.

        Strategy:
        1. Normalize and clean text
        2. Split into paragraphs
        3. Split paragraphs into sentences
        4. Build chunks respecting token limits and sentence boundaries
        5. Add overlap between chunks for context

        Args:
            text: Document text to chunk
            metadata: Document metadata to include in chunks

        Returns:
            List of DocumentChunk objects
        """
        if not text or not text.strip():
            logger.warning("Empty text provided for chunking")
            return []

        # Normalize text
        normalized_text = text_processor.normalize_text(text)

        # Split into paragraphs (preserve document structure)
        paragraphs = self._split_paragraphs(normalized_text)

        # Build chunks from paragraphs
        chunks = []
        current_chunk = []
        current_tokens = 0
        chunk_index = 0

        for para in paragraphs:
            para_tokens = text_processor.count_tokens(para)

            # If paragraph is too large, split it further
            if para_tokens > self.max_tokens:
                # Flush current chunk if any
                if current_chunk:
                    chunk_text = '\n\n'.join(current_chunk)
                    chunks.append(self._create_chunk(
                        chunk_text,
                        chunk_index,
                        metadata
                    ))
                    chunk_index += 1
                    current_chunk = []
                    current_tokens = 0

                # Split large paragraph by sentences
                para_chunks = await self._chunk_large_paragraph(para, metadata, chunk_index)
                chunks.extend(para_chunks)
                chunk_index += len(para_chunks)
                continue

            # Check if adding paragraph exceeds max tokens
            if current_tokens + para_tokens > self.max_tokens:
                # Flush current chunk
                if current_chunk:
                    chunk_text = '\n\n'.join(current_chunk)
                    chunks.append(self._create_chunk(
                        chunk_text,
                        chunk_index,
                        metadata
                    ))
                    chunk_index += 1

                # Start new chunk with overlap
                overlap_text = self._get_overlap_text(current_chunk)
                current_chunk = [overlap_text, para] if overlap_text else [para]
                current_tokens = text_processor.count_tokens('\n\n'.join(current_chunk))
            else:
                # Add paragraph to current chunk
                current_chunk.append(para)
                current_tokens += para_tokens

        # Flush remaining chunk
        if current_chunk:
            chunk_text = '\n\n'.join(current_chunk)
            token_count = text_processor.count_tokens(chunk_text)
            if token_count >= self.min_chunk_tokens:
                chunks.append(self._create_chunk(
                    chunk_text,
                    chunk_index,
                    metadata
                ))

        logger.info(f"Created {len(chunks)} chunks from document")
        return chunks

    def _split_paragraphs(self, text: str) -> list[str]:
        """Split text into paragraphs."""
        # Split on double newlines
        paragraphs = text.split('\n\n')

        # Filter empty paragraphs and strip whitespace
        paragraphs = [p.strip() for p in paragraphs if p.strip()]

        return paragraphs

    async def _chunk_large_paragraph(
        self,
        paragraph: str,
        metadata: dict[str, Any],
        start_index: int
    ) -> list[DocumentChunk]:
        """Chunk a paragraph that exceeds max tokens."""
        sentences = text_processor.split_sentences(paragraph)

        chunks = []
        current_chunk = []
        current_tokens = 0
        chunk_index = start_index

        for sentence in sentences:
            sentence_tokens = text_processor.count_tokens(sentence)

            # If single sentence exceeds max, split by tokens
            if sentence_tokens > self.max_tokens:
                # Flush current chunk
                if current_chunk:
                    chunk_text = ' '.join(current_chunk)
                    chunks.append(self._create_chunk(
                        chunk_text,
                        chunk_index,
                        metadata
                    ))
                    chunk_index += 1
                    current_chunk = []
                    current_tokens = 0

                # Split sentence by tokens (last resort)
                sentence_chunks = text_processor.chunk_by_tokens(
                    sentence,
                    self.max_tokens,
                    self.overlap_tokens
                )
                for sent_chunk in sentence_chunks:
                    chunks.append(self._create_chunk(
                        sent_chunk,
                        chunk_index,
                        metadata
                    ))
                    chunk_index += 1
                continue

            # Check if adding sentence exceeds max
            if current_tokens + sentence_tokens > self.max_tokens:
                # Flush current chunk
                if current_chunk:
                    chunk_text = ' '.join(current_chunk)
                    chunks.append(self._create_chunk(
                        chunk_text,
                        chunk_index,
                        metadata
                    ))
                    chunk_index += 1

                # Start new chunk with overlap
                overlap_text = self._get_sentence_overlap(current_chunk)
                current_chunk = [overlap_text, sentence] if overlap_text else [sentence]
                current_tokens = text_processor.count_tokens(' '.join(current_chunk))
            else:
                # Add sentence to current chunk
                current_chunk.append(sentence)
                current_tokens += sentence_tokens

        # Flush remaining chunk
        if current_chunk:
            chunk_text = ' '.join(current_chunk)
            token_count = text_processor.count_tokens(chunk_text)
            if token_count >= self.min_chunk_tokens:
                chunks.append(self._create_chunk(
                    chunk_text,
                    chunk_index,
                    metadata
                ))

        return chunks

    def _get_overlap_text(self, paragraphs: list[str]) -> str:
        """Get overlap text from previous chunk (last paragraph or partial)."""
        if not paragraphs:
            return ""

        # Try to get last paragraph
        last_para = paragraphs[-1]
        tokens = text_processor.count_tokens(last_para)

        if tokens <= self.overlap_tokens:
            return last_para

        # If last paragraph too long, get last few sentences
        sentences = text_processor.split_sentences(last_para)
        overlap = []
        overlap_tokens = 0

        for sentence in reversed(sentences):
            sentence_tokens = text_processor.count_tokens(sentence)
            if overlap_tokens + sentence_tokens > self.overlap_tokens:
                break
            overlap.insert(0, sentence)
            overlap_tokens += sentence_tokens

        return ' '.join(overlap)

    def _get_sentence_overlap(self, sentences: list[str]) -> str:
        """Get overlap text from previous sentences."""
        if not sentences:
            return ""

        overlap = []
        overlap_tokens = 0

        for sentence in reversed(sentences):
            sentence_tokens = text_processor.count_tokens(sentence)
            if overlap_tokens + sentence_tokens > self.overlap_tokens:
                break
            overlap.insert(0, sentence)
            overlap_tokens += sentence_tokens

        return ' '.join(overlap)

    def _create_chunk(
        self,
        text: str,
        chunk_index: int,
        metadata: dict[str, Any]
    ) -> DocumentChunk:
        """Create a DocumentChunk object."""
        token_count = text_processor.count_tokens(text)

        # Create chunk metadata
        chunk_metadata = {
            **metadata,
            'chunk_index': chunk_index,
        }

        return DocumentChunk(
            text=text,
            chunk_index=chunk_index,
            token_count=token_count,
            metadata=chunk_metadata
        )
