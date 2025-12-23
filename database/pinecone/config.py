"""
Pinecone Vector Database Configuration for InnoSynth.ai
"""

PINECONE_CONFIG = {
    "index_name": "innosynth-documents",
    "dimension": 1536,  # OpenAI text-embedding-3-small output dimension
    "metric": "cosine",
    "spec": {
        "serverless": {
            "cloud": "aws",
            "region": "us-east-1"
        }
    },
    "metadata_config": {
        "indexed": [
            "organization_id",
            "source_system",
            "author",
            "created_at"
        ]
    }
}

# Metadata schema for vectors
VECTOR_METADATA_SCHEMA = {
    "document_id": str,           # UUID from PostgreSQL
    "organization_id": str,       # Organization UUID
    "source_system": str,         # 'sharepoint', 'gdrive', 'slack'
    "title": str,                 # Document title
    "author": str,                # Author name/email
    "created_at": str,            # ISO timestamp
    "url": str,                   # Link to source
    "chunk_index": int,           # Position in document
    "chunk_total": int            # Total chunks in document
}

# Search configuration
SEARCH_CONFIG = {
    "top_k": 20,                  # Number of results to return
    "include_metadata": True,
    "include_values": False       # We don't need the vectors back
}
