import os
from slowapi import Limiter
from slowapi.util import get_remote_address

REDIS_URL = os.getenv("REDIS_URL", "")

# Use Redis if available, otherwise fall back to memory
if REDIS_URL:
    try:
        import redis as _redis
        _test = _redis.Redis.from_url(REDIS_URL, socket_connect_timeout=2)
        _test.ping()
        _storage_uri = REDIS_URL
        print("✅ Rate limiter using Redis")
    except Exception as e:
        print(f"⚠️  Rate limiter Redis unavailable — using memory: {e}")
        _storage_uri = "memory://"
else:
    _storage_uri = "memory://"

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=_storage_uri,
)