# NEW
"""
Knowledge Base Routes – upload, list, delete per-user PDFs.
Each user gets an isolated Chroma collection: user_{user_id}
Shared admin collection retained as "shared" for global docs.
"""
import asyncio
import os
import shutil
import glob
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from backend.core.jwt_auth import get_current_user
from backend.core.config import KNOWLEDGE_UPLOAD_DIR, CHROMA_BASE_DIR
from backend.ingest import ingest_pdfs

router = APIRouter()

CHROMA_BASE = CHROMA_BASE_DIR
BASE_UPLOAD_DIR = KNOWLEDGE_UPLOAD_DIR
os.makedirs(BASE_UPLOAD_DIR, exist_ok=True)


def _user_upload_dir(user_id: str) -> str:
    path = os.path.join(BASE_UPLOAD_DIR, f"user_{user_id}")
    os.makedirs(path, exist_ok=True)
    return path


def _user_session(user_id: str) -> str:
    return f"user_{user_id}"


async def require_admin(current_user: dict = Depends(get_current_user)):
    from backend.db import get_connection, release_connection
    def _check():
        conn = get_connection()
        try:
            cur = conn.cursor()
            cur.execute("SELECT is_admin FROM users WHERE id = %s", (current_user["user_id"],))
            return cur.fetchone()
        finally:
            release_connection(conn)
    row = await asyncio.to_thread(_check)
    if not row or not row[0]:
        raise HTTPException(status_code=403, detail="Admin access required.")
    return current_user


@router.post("/knowledge/upload")
async def upload_document(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),   # all users can upload
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds 20MB limit.")
    if not content.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Invalid PDF file.")

    import re
    safe_name = os.path.basename(file.filename or "").replace(" ", "_")
    safe_name = re.sub(r"[^\w\-.]", "", safe_name)  # allowlist: word chars, hyphens, dots
    if not safe_name or not safe_name.lower().endswith(".pdf") or safe_name.startswith("."):
        raise HTTPException(status_code=400, detail="Invalid filename.")

    user_id    = current_user["user_id"]
    upload_dir = _user_upload_dir(user_id)
    session_id = _user_session(user_id)

    existing = glob.glob(os.path.join(upload_dir, "*.pdf"))
    if len(existing) >= 20:
        raise HTTPException(status_code=400, detail="Maximum 20 documents per user.")

    save_path = os.path.join(upload_dir, safe_name)
    with open(save_path, "wb") as f:
        f.write(content)

    # Re-check post-write
    if len(glob.glob(os.path.join(upload_dir, "*.pdf"))) > 20:
        os.remove(save_path)
        raise HTTPException(status_code=400, detail="Maximum 20 documents per user.")

    try:
        # Evict stale cache entry so get_vector_db recreates a clean collection
        from backend.services.vector_service import _db_cache, _db_cache_lock
        with _db_cache_lock:
            _db_cache.pop(session_id, None)

        # Wipe and rebuild the Chroma collection from scratch
        chroma_dir = os.path.join(CHROMA_BASE, session_id)
        if os.path.exists(chroma_dir):
            shutil.rmtree(chroma_dir)

        await asyncio.to_thread(ingest_pdfs, upload_dir, session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {e}")

    return {"status": "ingested", "filename": safe_name, "session_id": session_id}


@router.get("/knowledge/documents")
async def list_documents(current_user: dict = Depends(get_current_user)):
    upload_dir = _user_upload_dir(current_user["user_id"])
    files = glob.glob(os.path.join(upload_dir, "*.pdf"))
    return {"documents": [os.path.basename(f) for f in sorted(files)]}


@router.delete("/knowledge/documents/{filename}")
async def delete_document(
    filename: str,
    current_user: dict = Depends(get_current_user),
):
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")

    user_id    = current_user["user_id"]
    upload_dir = _user_upload_dir(user_id)
    session_id = _user_session(user_id)

    file_path = os.path.join(upload_dir, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found.")

    os.remove(file_path)

    try:
        remaining = glob.glob(os.path.join(upload_dir, "*.pdf"))
        chroma_dir = os.path.join(CHROMA_BASE, session_id)
        if remaining:
            await asyncio.to_thread(ingest_pdfs, upload_dir, session_id)
        else:
            # No files left — safe to wipe
            if os.path.exists(chroma_dir):
                shutil.rmtree(chroma_dir)
    except Exception as e:
        print(f"⚠️ Re-ingest after delete failed: {e}")

    return {"status": "deleted", "filename": filename}


# Admin-only: list all users' document counts
@router.get("/knowledge/admin/summary")
async def admin_summary(current_user: dict = Depends(require_admin)):
    summary = []
    for entry in os.scandir(BASE_UPLOAD_DIR):
        if entry.is_dir() and entry.name.startswith("user_"):
            count = len(glob.glob(os.path.join(entry.path, "*.pdf")))
            summary.append({"user_session": entry.name, "document_count": count})
    return {"users": summary}