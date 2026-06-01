from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


# Use auth token if present, otherwise IP
def get_user_or_ip(request: Request) -> str:
    auth = request.headers.get("Authorization", "")

    if auth.startswith("Bearer ") and len(auth) > 10:
        return auth

    return get_remote_address(request)


limiter = Limiter(key_func=get_user_or_ip)