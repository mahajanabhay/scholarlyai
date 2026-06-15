import os
from slowapi import Limiter
from slowapi.util import get_remote_address
from limits.storage import MemoryStorage, RedisStorage

REDIS_URL = os.getenv("REDIS_URL", "")

def _get_storage():
    if REDIS_URL:
        try:
            storage = RedisStorage(REDIS_URL)
            # Test connection
            storage.check()
            print("✅ Rate limiter using Redis storage")
            return storage
        except Exception as e:
            print(f"⚠️  Rate limiter Redis unavailable — using memory: {e}")
    return MemoryStorage()

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=None,
    storage=_get_storage(),
)