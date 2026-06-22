from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from backend.core.config import REDIS_URL, ENVIRONMENT


def get_user_or_ip(request: Request) -> str:
    token = request.cookies.get("scholarly_token")
    if token and len(token) > 10:
        return token
    return get_remote_address(request)


def _make_limiter() -> Limiter:
    try:
        import redis as _redis
        _test = _redis.Redis.from_url(REDIS_URL, socket_connect_timeout=2)
        _test.ping()
        print("Rate limiter using Redis")
        return Limiter(key_func=get_user_or_ip, storage_uri=REDIS_URL)
    except Exception as e:
        if ENVIRONMENT == "development":
            print(f"Rate limiter falling back to memory (dev only): {e}")
            return Limiter(key_func=get_user_or_ip)
        raise RuntimeError(f"Redis required for rate limiting in production: {e}")


limiter = _make_limiter()