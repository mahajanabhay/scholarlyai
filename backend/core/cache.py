"""
Redis cache — drop-in replacement for the in-memory dicts in memory_service.
Falls back to a plain dict if Redis is unavailable (dev/test environments).
"""
import os
import json
import redis
from backend.core.config import REDIS_URL, CACHE_TTL
TTL = CACHE_TTL

try:
    _client = redis.Redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=2)
    _client.ping()
    _REDIS_AVAILABLE = True
    print("✅ Redis connected")
except Exception as e:
    print(f"⚠️  Redis unavailable — falling back to in-memory cache: {e}")
    _REDIS_AVAILABLE = False
    _fallback: dict = {}


def get(key: str):
    if _REDIS_AVAILABLE:
        try:
            val = _client.get(key)
            return json.loads(val) if val else None
        except Exception:
            return None
    return _fallback.get(key)


def set(key: str, value, ttl: int = TTL):
    if _REDIS_AVAILABLE:
        try:
            _client.setex(key, ttl, json.dumps(value))
        except Exception:
            pass
    else:
        _fallback[key] = value


def delete(key: str):
    if _REDIS_AVAILABLE:
        try:
            _client.delete(key)
        except Exception:
            pass
    else:
        _fallback.pop(key, None)