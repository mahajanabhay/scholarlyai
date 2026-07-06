import sys
import io

# Force UTF-8 stdout/stderr — prevents UnicodeEncodeError crashes on Windows
# consoles (cp1252) when any print() contains emoji or non-ASCII characters.
# Must run before any other import that might print at module load time.
if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr.encoding != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

from contextlib import asynccontextmanager
import os
import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from backend.core.config import ALLOWED_ORIGINS
from backend.routes import auth_routes, profile_routes, chat_routes, quiz_routes, study_routes, knowledge_routes, referral_routes

from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from backend.core.config import SENTRY_DSN, ENVIRONMENT
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[FastApiIntegration(), StarletteIntegration()],
        traces_sample_rate=0.2,
        environment=ENVIRONMENT,
    )

# ── Startup / shutdown ─────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schema is now owned by Alembic migrations (run via start.sh before
    # this process starts). init_db() is kept in db.py only as a manual
    # fallback for a from-scratch local setup — it's intentionally not
    # called here to avoid two systems both trying to own the schema.

    # Start daily notification scheduler (runs every 6 hours)
    import asyncio as _asyncio

    async def _notification_loop():
        while True:
            try:
                from backend.services.notification_scheduler import schedule_daily_notifications
                await _asyncio.to_thread(schedule_daily_notifications)
            except Exception as e:
                print(f"⚠️ Notification scheduler error: {e}")
            await _asyncio.sleep(6 * 60 * 60)  # every 6 hours

    loop = _asyncio.get_event_loop()
    loop.create_task(_notification_loop())

    try:
        from backend.core.config import KNOWLEDGE_UPLOAD_DIR
        from backend.ingest import ingest_pdfs
        import glob

        # Re-index each user's upload directory in background — never block startup
        async def _reindex_all():
            import asyncio as _asyncio
            if os.path.exists(KNOWLEDGE_UPLOAD_DIR):
                for entry in os.scandir(KNOWLEDGE_UPLOAD_DIR):
                    if entry.is_dir() and entry.name.startswith("user_"):
                        pdfs = glob.glob(os.path.join(entry.path, "*.pdf"))
                        if pdfs:
                            session_id = entry.name
                            print(f"📄 Re-indexing {len(pdfs)} PDFs for {session_id}...")
                            await _asyncio.to_thread(ingest_pdfs, entry.path, session_id)
            print("✅ Per-user knowledge bases re-indexed.")

        import asyncio as _asyncio
        loop = _asyncio.get_event_loop()
        loop.create_task(_reindex_all())
    except Exception as e:
        print(f"⚠️  Chroma re-index skipped: {e}")

    yield
    # Shutdown cleanup here if needed

from backend.core.limiter import limiter


app = FastAPI(title="ScholarlyAI API", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Referral-Code"],
)

app.include_router(auth_routes.router)
app.include_router(profile_routes.router)
app.include_router(chat_routes.router)
app.include_router(quiz_routes.router)
app.include_router(study_routes.router)
app.include_router(knowledge_routes.router)
app.include_router(referral_routes.router)

import time

_health_cache = {"ts": 0, "groq": "error", "groq_error": None}
_HEALTH_CACHE_TTL = 30  # seconds

@app.get("/health")
async def health_check():
    import asyncio
    from backend.db import get_connection, release_connection, connection_pool
    from backend.core.llm import client, LLM_MODEL

    status = {"api": "ok", "db": "error", "groq": "error", "pool_available": 0}

    # Check DB
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT 1")
        release_connection(conn)
        status["db"] = "ok"
        try:
            status["pool_available"] = connection_pool.maxconn - len(connection_pool._used)
        except AttributeError:
            status["pool_available"] = -1
    except Exception as e:
        status["db_error"] = str(e)

    # Check Groq (cached — avoid hammering Groq on every uptime-monitor hit)
    now = time.time()
    if now - _health_cache["ts"] < _HEALTH_CACHE_TTL:
        status["groq"] = _health_cache["groq"]
        if _health_cache["groq_error"]:
            status["groq_error"] = _health_cache["groq_error"]
    else:
        try:
            def _ping():
                return client.chat.completions.create(
                    model=LLM_MODEL,
                    messages=[{"role": "user", "content": "ping"}],
                    max_tokens=1,
                    timeout=5.0,
                )
            await asyncio.wait_for(asyncio.to_thread(_ping), timeout=6.0)
            status["groq"] = "ok"
            _health_cache.update(ts=now, groq="ok", groq_error=None)
        except Exception as e:
            status["groq_error"] = str(e)[:100]
            _health_cache.update(ts=now, groq="error", groq_error=status["groq_error"])

    return status