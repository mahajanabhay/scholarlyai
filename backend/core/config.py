import os
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY      = os.getenv("GROQ_API_KEY")
ALLOWED_ORIGINS   = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
MAX_HISTORY       = int(os.getenv("MAX_HISTORY_LENGTH", 10))
MAX_TOKENS        = int(os.getenv("MAX_TOKENS_OUTPUT", 30000))
CHROMA_BASE_DIR   = os.getenv("CHROMA_BASE_DIR", "./chroma_db")
EMBED_MODEL       = os.getenv("EMBED_MODEL", "all-MiniLM-L6-v2")
LLM_MODEL         = os.getenv("LLM_MODEL", "llama-3.3-70b-versatile")
MAX_FILE_SIZE     = int(os.getenv("MAX_FILE_SIZE", 50 * 1024 * 1024))  # 50MB default
MAX_USER_MESSAGE_LEN = int(os.getenv("MAX_USER_MESSAGE_LEN", "4000"))

# Validate required environment variables
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY environment variable is not set. Please configure it in your .env file.")