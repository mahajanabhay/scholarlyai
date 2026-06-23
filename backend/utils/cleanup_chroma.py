"""
Run manually or via cron to delete Chroma vector DB dirs older than 30 days.
Cron example (runs daily at 2am):
  0 2 * * * cd /path/to/project && python -m backend.utils.cleanup_chroma
"""
import os
import shutil
import time
from pathlib import Path
from backend.core.config import CHROMA_BASE_DIR as _CHROMA_BASE, CHROMA_MAX_AGE_DAYS

CHROMA_BASE_DIR = Path(_CHROMA_BASE)
MAX_AGE_DAYS    = CHROMA_MAX_AGE_DAYS
cutoff          = time.time() - (MAX_AGE_DAYS * 86400)

if not CHROMA_BASE_DIR.exists():
    print(f"⚠️ {CHROMA_BASE_DIR} does not exist — nothing to clean.")
    exit(0)

deleted, skipped = 0, 0
for entry in CHROMA_BASE_DIR.iterdir():
    if not entry.is_dir():
        continue
    # Never delete user knowledge base dirs — only loadtest/temp dirs
    if entry.name.startswith("user_") or entry.name in ("shared", "test"):
        continue
    if entry.stat().st_mtime < cutoff:
        shutil.rmtree(entry)
        print(f"🗑️  Deleted {entry.name}")
        deleted += 1
    else:
        skipped += 1

print(f"✅ Done — {deleted} deleted, {skipped} kept")