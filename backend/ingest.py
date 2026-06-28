"""
ingest.py — Batch PDF ingestion utility.

Run this once to pre-load books / documents into a shared knowledge base
before launching the app. This is separate from the per-session memory that
gets built automatically during chat.

Usage:
    python ingest.py --session shared --dir books/
"""

import os
import glob
import argparse
import threading
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from backend.core.config import CHROMA_BASE_DIR, EMBED_MODEL
from backend.services.vector_service import get_vector_db

# Lock for concurrent access to vector store
import collections
_ingest_locks: dict = {}
_ingest_locks_lock = threading.Lock()

def _get_session_lock(session_id: str) -> threading.Lock:
    with _ingest_locks_lock:
        if session_id not in _ingest_locks:
            _ingest_locks[session_id] = threading.Lock()
        return _ingest_locks[session_id]


def ingest_pdfs(pdf_dir: str, session_id: str = "shared") -> None:
    pdf_files = glob.glob(os.path.join(pdf_dir, "*.pdf"))
    if not pdf_files:
        print(f"⚠️  No PDF files found in '{pdf_dir}'")
        return

    print(f"--- Found {len(pdf_files)} PDF(s) in '{pdf_dir}' ---")

    with _get_session_lock(session_id):
        try:
            text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
            vector_db = get_vector_db(session_id)
            for pdf_path in pdf_files:
                try:
                    loader = PyPDFLoader(pdf_path)
                    docs   = loader.load()
                    chunks = text_splitter.split_documents(docs)
                    vector_db.add_documents(chunks)
                    print(f"  ✅ Indexed {len(chunks)} chunks from {os.path.basename(pdf_path)}")
                except Exception as e:
                    print(f"  ❌ Failed to index {pdf_path}: {e}")
            print(f"\n✅ Done — session '{session_id}'")
        except Exception as e:
            print(f"❌ Error during PDF ingestion: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Batch-ingest PDFs into ScholarlyAI vector store")
    parser.add_argument("--dir",     default="books/",  help="Directory containing PDFs")
    parser.add_argument("--session", default="shared",  help="Session/user ID for the vector store")
    args = parser.parse_args()
    ingest_pdfs(args.dir, args.session)