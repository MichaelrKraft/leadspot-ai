"""
Script to initialize Pinecone index for InnoSynth.ai
"""
import os
from pinecone import Pinecone, ServerlessSpec
from config import PINECONE_CONFIG

def create_index():
    """Create the Pinecone index if it doesn't exist."""
    pc = Pinecone(api_key=os.environ.get("PINECONE_API_KEY"))

    # Check if index already exists
    existing_indexes = pc.list_indexes().names()

    if PINECONE_CONFIG["index_name"] not in existing_indexes:
        print(f"Creating index: {PINECONE_CONFIG['index_name']}")
        pc.create_index(
            name=PINECONE_CONFIG["index_name"],
            dimension=PINECONE_CONFIG["dimension"],
            metric=PINECONE_CONFIG["metric"],
            spec=ServerlessSpec(**PINECONE_CONFIG["spec"]["serverless"])
        )
        print("Index created successfully!")
    else:
        print(f"Index {PINECONE_CONFIG['index_name']} already exists.")

    # Get index info
    index = pc.Index(PINECONE_CONFIG["index_name"])
    stats = index.describe_index_stats()
    print(f"Index stats: {stats}")

    return index

if __name__ == "__main__":
    create_index()
