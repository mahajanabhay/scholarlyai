from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from backend import knowledge_routes
from backend.core.config import ALLOWED_ORIGINS, GROQ_API_KEY, LLM_MODEL
from backend.db import init_db
from backend.routes import auth_routes, profile_routes, chat_routes, quiz_routes, study_routes
knowledge_routes


# ── Startup / shutdown ─────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Runs once when the server starts — creates tables and indexes if missing
    init_db()
    yield
    # (add any shutdown cleanup here if needed)

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