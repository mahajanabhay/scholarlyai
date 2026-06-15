import os
from collections import OrderedDict
from langchain_chroma import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from backend.core.config import CHROMA_BASE_DIR, EMBED_MODEL
import chromadb

from backend.core.config import CHROMA_HOST, CHROMA_PORT

try:
    _chroma_client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
    _chroma_client.heartbeat()
    _USE_HTTP_CHROMA = True
    print(f"✅ Chroma HTTP connected at {CHROMA_HOST}:{CHROMA_PORT}")
except Exception as e:
    print(f"⚠️  Chroma HTTP unavailable — using local PersistentClient: {e}")
    _chroma_client = None
    _USE_HTTP_CHROMA = False

# Lazy-loaded — HuggingFaceEmbeddings downloads ~90MB model on first call.
# Loading at import time blocks every worker startup and crashes the app
# if the download fails. Instead, initialise once on first actual use.
_embeddings: HuggingFaceEmbeddings | None = None

def _get_embeddings() -> HuggingFaceEmbeddings:
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(model_name=EMBED_MODEL)
    return _embeddings


# ── LRU cache for Chroma connections ──────────────────────────────────────
# Without a size cap, every unique session_id opens a Chroma instance that
# is never closed — leaking file handles and RAM indefinitely. With 50 slots,
# the least-recently-used session is evicted when the cap is reached. Chroma
# persists to disk, so evicted sessions reconnect transparently on next hit.
#
# Uses stdlib OrderedDict — no extra dependency required.
# ─────────────────────────────────────────────────────────────────────────
_DB_CACHE_MAX = 50
_db_cache: OrderedDict[str, Chroma] = OrderedDict()
_quiz_memory: dict[str, dict] = {}

def get_vector_db(session_id: str) -> Chroma:
    if session_id in _db_cache:
        _db_cache.move_to_end(session_id)
        return _db_cache[session_id]

    if len(_db_cache) >= _DB_CACHE_MAX:
        evicted_id, _ = _db_cache.popitem(last=False)
        print(f"[vector_service] Evicted session '{evicted_id}' from Chroma cache (cap={_DB_CACHE_MAX})")

    if _USE_HTTP_CHROMA and _chroma_client:
        _db_cache[session_id] = Chroma(
            client=_chroma_client,
            collection_name=f"session_{session_id}",
            embedding_function=_get_embeddings(),
        )
    else:
        persist_dir = os.path.join(CHROMA_BASE_DIR, session_id)
        os.makedirs(persist_dir, exist_ok=True)
        _db_cache[session_id] = Chroma(
            persist_directory=persist_dir,
            embedding_function=_get_embeddings(),
        )
    return _db_cache[session_id]

def get_quiz_memory(session_id: str) -> dict:
    if session_id not in _quiz_memory:
        _quiz_memory[session_id] = {
            "asked_questions": [],
            "asked_topics": [],
            "quiz_topic": None,
        }
    return _quiz_memory[session_id]

def reset_quiz_memory(session_id: str):
    if session_id in _quiz_memory:
        _quiz_memory[session_id] = {
            "asked_questions": [],
            "asked_topics": [],
            "quiz_topic": None,
        }