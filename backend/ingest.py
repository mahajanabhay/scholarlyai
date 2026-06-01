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
from dotenv import load_dotenv

load_dotenv()

CHROMA_BASE_DIR = os.getenv("CHROMA_BASE_DIR", "./chroma_db")
EMBED_MODEL     = os.getenv("EMBED_MODEL", "all-MiniLM-L6-v2")

# Lock for concurrent access to vector store
_ingest_lock = threading.Lock()


def ingest_pdfs(pdf_dir: str, session_id: str = "shared") -> None:
    """
    Ingest PDFs into the vector store for a specific session.
    Uses a lock to prevent concurrent access issues.
    """
    persist_dir = os.path.join(CHROMA_BASE_DIR, session_id)
    
    # Validate session directory
    try:
        os.makedirs(persist_dir, exist_ok=True)
    except Exception as e:
        print(f"❌ Failed to create session directory '{persist_dir}': {e}")
        return

    pdf_files = glob.glob(os.path.join(pdf_dir, "*.pdf"))
    if not pdf_files:
        print(f"⚠️  No PDF files found in '{pdf_dir}'")
        return

    print(f"--- Found {len(pdf_files)} PDF(s) in '{pdf_dir}' ---")

    # Use lock to prevent concurrent access to vector store
    with _ingest_lock:
        try:
            text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
            embeddings    = HuggingFaceEmbeddings(model_name=EMBED_MODEL)
            vector_db     = Chroma(persist_directory=persist_dir, embedding_function=embeddings)

            for pdf_path in pdf_files:
                print(f"  Loading: {pdf_path}")
                try:
                    loader = PyPDFLoader(pdf_path)
                    docs   = loader.load()
                    chunks = text_splitter.split_documents(docs)
                    vector_db.add_documents(chunks)
                    print(f"  ✅ Indexed {len(chunks)} chunks from {os.path.basename(pdf_path)}")
                except Exception as e:
                    print(f"  ❌ Failed to index {pdf_path}: {e}")

            print(f"\n✅ Done — all PDFs saved to session '{session_id}' at {persist_dir}")
        except Exception as e:
            print(f"❌ Error during PDF ingestion: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Batch-ingest PDFs into ScholarlyAI vector store")
    parser.add_argument("--dir",     default="books/",  help="Directory containing PDFs")
    parser.add_argument("--session", default="shared",  help="Session/user ID for the vector store")
    args = parser.parse_args()
    ingest_pdfs(args.dir, args.session)