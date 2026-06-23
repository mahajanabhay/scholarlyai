"""
JWT Authentication Utility
Handles token creation and verification
"""
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, Header
from typing import Optional
from fastapi import Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from backend.core.config import JWT_SECRET

SECRET_KEY  = JWT_SECRET
ALGORITHM   = "HS256"
EXPIRY_DAYS = 7


def create_token(user_id: str, email: str) -> str:
    """Create a JWT token for a user"""
    now = datetime.now(timezone.utc)
    payload = {
        "user_id": user_id,
        "email":   email,
        "iat":     now,
        "exp":     now + timedelta(days=EXPIRY_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> dict:
    """Verify a JWT token and return its payload"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token. Please log in again.")

bearer_scheme = HTTPBearer(auto_error=False)

def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)
) -> dict:
    """
    Accepts token from httpOnly cookie OR Authorization header (fallback).
    """
    # 1. Try httpOnly cookie first
    token = request.cookies.get("scholarly_token")

    # 2. Fall back to Bearer header
    if not token and credentials:
        token = credentials.credentials

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated.")

    return verify_token(token)