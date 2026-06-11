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
    allow_origins=ALLOWED_ORIGINS,
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
    from backend.db import get_connection, release_connection, connection_pool
    status = {"api": "ok", "db": "error", "pool_available": 0}
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT 1")
        release_connection(conn)
        status["db"] = "ok"
        status["pool_available"] = connection_pool.maxconn - len(connection_pool._used)
    except Exception as e:
        status["db_error"] = str(e)
    return status