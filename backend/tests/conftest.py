import os
from unittest.mock import MagicMock, patch

# Set env BEFORE any imports
os.environ["ENVIRONMENT"]    = "development"
os.environ["DB_PASSWORD"]    = "testpassword"
os.environ["GROQ_API_KEY"]   = "test_groq_key"
os.environ["JWT_SECRET"]     = "test_jwt_secret"
os.environ["APP_URL"]        = "http://localhost:3000"
os.environ["ALLOWED_ORIGINS"] = "http://localhost:3000"
os.environ["SMTP_USER"]      = ""
os.environ["SMTP_PASSWORD"]  = ""
os.environ["REDIS_URL"]      = "redis://localhost:6379/0"

# Patch Redis and DB pool before any backend module loads
import sys

# Mock redis module entirely
redis_mock = MagicMock()
redis_client_mock = MagicMock()
redis_client_mock.ping.return_value = True
redis_mock.Redis.from_url.return_value = redis_client_mock
sys.modules["redis"] = redis_mock

# Mock psycopg2 pool
pool_mock = MagicMock()
pool_mock.getconn.return_value = MagicMock()
psycopg2_mock = MagicMock()
psycopg2_mock.pool.ThreadedConnectionPool.return_value = pool_mock
sys.modules.setdefault("psycopg2", psycopg2_mock)