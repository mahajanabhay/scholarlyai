# NEW
import os
from dotenv import load_dotenv

load_dotenv()  # single load point for the entire app

def _require(key: str) -> str:
    val = os.getenv(key)
    if not val:
        raise RuntimeError(f"{key} environment variable is not set. Refusing to start.")
    return val

# Required
GROQ_API_KEY     = _require("GROQ_API_KEY")
JWT_SECRET       = _require("JWT_SECRET")
DB_PASSWORD      = _require("DB_PASSWORD")

# Optional with defaults
ALLOWED_ORIGINS      = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
MAX_HISTORY          = int(os.getenv("MAX_HISTORY_LENGTH", 10))
MAX_TOKENS           = int(os.getenv("MAX_TOKENS_OUTPUT", 30000))
CHROMA_BASE_DIR      = os.getenv("CHROMA_BASE_DIR", "./chroma_db")
EMBED_MODEL          = "sentence-transformers/all-MiniLM-L6-v2"
LLM_MODEL            = os.getenv("LLM_MODEL", "llama-3.3-70b-versatile")
MAX_FILE_SIZE        = int(os.getenv("MAX_FILE_SIZE", 50 * 1024 * 1024))
MAX_USER_MESSAGE_LEN = int(os.getenv("MAX_USER_MESSAGE_LEN", "4000"))
CHROMA_HOST          = os.getenv("CHROMA_HOST", "localhost")
CHROMA_PORT          = int(os.getenv("CHROMA_PORT", "8001"))
REDIS_URL            = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CACHE_TTL            = int(os.getenv("CACHE_TTL_SECONDS", "300"))
DB_HOST              = os.getenv("DB_HOST", "localhost")
DB_PORT              = os.getenv("DB_PORT", "5432")
DB_NAME              = os.getenv("DB_NAME", "scholarly_ai")
DB_USER              = os.getenv("DB_USER", "postgres")
SMTP_HOST            = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT            = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER            = os.getenv("SMTP_USER", "")
SMTP_PASSWORD        = os.getenv("SMTP_PASSWORD", "")
APP_URL              = os.getenv("APP_URL", "http://localhost:3000")
SENTRY_DSN           = os.getenv("SENTRY_DSN", "")
ENVIRONMENT          = os.getenv("ENVIRONMENT", "production")
KNOWLEDGE_UPLOAD_DIR = os.getenv("KNOWLEDGE_UPLOAD_DIR", "./knowledge_uploads")
CHROMA_MAX_AGE_DAYS  = int(os.getenv("CHROMA_MAX_AGE_DAYS", "30"))