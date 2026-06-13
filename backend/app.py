from contextlib import asynccontextmanager
import os
import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from backend.core.config import ALLOWED_ORIGINS, GROQ_API_KEY, LLM_MODEL
from backend.db import init_db
from backend.routes import auth_routes, profile_routes, chat_routes, quiz_routes, study_routes, knowledge_routes

from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

SENTRY_DSN = os.getenv("SENTRY_DSN", "")
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[FastApiIntegration(), StarletteIntegration()],
        traces_sample_rate=0.2,
        environment=os.getenv("ENVIRONMENT", "production"),
    )

# ── Startup / shutdown ─────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()

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

    _asyncio.create_task(_notification_loop())

    try:
        from backend.services.vector_service import get_or_create_collection
        from backend.ingest import ingest_pdfs
        import glob

        UPLOAD_DIR     = os.getenv("KNOWLEDGE_UPLOAD_DIR", "./knowledge_uploads")
        SHARED_SESSION = "shared"

        collection = get_or_create_collection(SHARED_SESSION)
        if collection.count() == 0:
            pdfs = glob.glob(os.path.join(UPLOAD_DIR, "*.pdf"))
            if pdfs:
                print(f"🔄 Re-indexing {len(pdfs)} PDFs into shared knowledge base...")
                ingest_pdfs(UPLOAD_DIR, SHARED_SESSION)
                print("✅ Shared knowledge base re-indexed.")
            else:
                print("ℹ️  No PDFs found in knowledge_uploads — skipping re-index.")
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
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(profile_routes.router)
app.include_router(chat_routes.router)
app.include_router(quiz_routes.router)
app.include_router(study_routes.router)
app.include_router(knowledge_routes.router)

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
        status["pool_available"] = connection_pool.maxconn - len(connection_pool._used)
    except Exception as e:
        status["db_error"] = str(e)

    # Check Groq
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
    except Exception as e:
        status["groq_error"] = str(e)[:100]

    return status