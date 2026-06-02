"""
Knowledge Base Routes — upload, list, delete shared PDFs
"""
import os
import shutil
import glob
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from backend.core.jwt_auth import get_current_user
from backend.ingest import ingest_pdfs

def require_admin(current_user: dict = Depends(get_current_user)):
    from backend.db import get_connection, release_connection
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT is_admin FROM users WHERE id = %s", (current_user["user_id"],))
        row = cur.fetchone()
        if not row or not row[0]:
            raise HTTPException(status_code=403, detail="Admin access required.")
        return current_user
    finally:
        release_connection(conn)

router = APIRouter()

UPLOAD_DIR  = os.getenv("KNOWLEDGE_UPLOAD_DIR", "./knowledge_uploads")
CHROMA_BASE = os.getenv("CHROMA_BASE_DIR", "./chroma_db")
SHARED_SESSION = "shared"

os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/knowledge/upload")
async def upload_document(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_admin)
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    save_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        ingest_pdfs(UPLOAD_DIR, SHARED_SESSION)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {e}")

    return {"status": "ingested", "filename": file.filename}


@router.get("/knowledge/documents")
async def list_documents(current_user: dict = Depends(get_current_user)):
    files = glob.glob(os.path.join(UPLOAD_DIR, "*.pdf"))
    return {"documents": [os.path.basename(f) for f in sorted(files)]}


@router.delete("/knowledge/documents/{filename}")
async def delete_document(
    filename: str,
    current_user: dict = Depends(require_admin)
):
    # Sanitise — no path traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")

    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found.")

    os.remove(file_path)

    # Re-ingest remaining docs so Chroma stays in sync
    try:
        shared_dir = os.path.join(CHROMA_BASE, SHARED_SESSION)
        if os.path.exists(shared_dir):
            shutil.rmtree(shared_dir)
        remaining = glob.glob(os.path.join(UPLOAD_DIR, "*.pdf"))
        if remaining:
            ingest_pdfs(UPLOAD_DIR, SHARED_SESSION)
    except Exception as e:
        print(f"⚠️ Re-ingest after delete failed: {e}")

    return {"status": "deleted", "filename": filename}