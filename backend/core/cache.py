"""
Redis cache — drop-in replacement for in-memory dicts.
Fails closed in production if Redis is unavailable; falls back to
in-memory only in development.
"""
import json
from backend.core.config import REDIS_URL, CACHE_TTL, ENVIRONMENT

TTL = CACHE_TTL
_REDIS_AVAILABLE = False
_fallback: dict = {}

try:
    import redis
    _client = redis.Redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=2)
    _client.ping()
    _REDIS_AVAILABLE = True
    print("Redis connected")
except Exception as e:
    if ENVIRONMENT == "development":
        print(f"Redis unavailable — falling back to in-memory cache (dev only): {e}")
    else:
        raise RuntimeError(f"Redis is required in production but unavailable: {e}")


def get(key: str):
    if _REDIS_AVAILABLE:
        try:
            val = _client.get(key)
            return json.loads(val) if val else None
        except Exception:
            return None
    return _fallback.get(key) if ENVIRONMENT == "development" else None


def set(key: str, value, ttl: int = TTL):
    if _REDIS_AVAILABLE:
        try:
            _client.setex(key, ttl, json.dumps(value))
        except Exception:
            pass
    elif ENVIRONMENT == "development":
        _fallback[key] = value


def delete(key: str):
    if _REDIS_AVAILABLE:
        try:
            _client.delete(key)
        except Exception:
            pass
    elif ENVIRONMENT == "development":
        _fallback.pop(key, None)