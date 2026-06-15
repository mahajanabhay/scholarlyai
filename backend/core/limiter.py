# NEW
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from backend.core.config import REDIS_URL, ENVIRONMENT


def get_user_or_ip(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer ") and len(auth) > 10:
        return auth
    return get_remote_address(request)


def _make_limiter() -> Limiter:
    try:
        from limits.storage import RedisStorage
        storage = RedisStorage(REDIS_URL)
        return Limiter(key_func=get_user_or_ip, storage_uri=REDIS_URL)
    except Exception as e:
        if ENVIRONMENT == "development":
            print(f"⚠️  Rate limiter falling back to memory (dev only): {e}")
            return Limiter(key_func=get_user_or_ip)
        raise RuntimeError(f"Redis required for rate limiting in production: {e}")


limiter = _make_limiter()