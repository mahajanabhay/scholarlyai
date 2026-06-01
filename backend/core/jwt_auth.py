"""
JWT Authentication Utility
Handles token creation and verification
"""
import jwt
import os
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, Header
from typing import Optional
from dotenv import load_dotenv
from fastapi import Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET")
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET environment variable is not set. Refusing to start without a signing secret.")
ALGORITHM  = "HS256"
EXPIRY_DAYS = 7


def create_token(user_id: str, email: str) -> str:
    """Create a JWT token for a user"""
    payload = {
        "user_id": user_id,
        "email":   email,
        "exp":     datetime.utcnow() + timedelta(days=EXPIRY_DAYS),
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

bearer_scheme = HTTPBearer()
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> dict:
    """
    FastAPI dependency — extracts and verifies the Bearer token.
    """
    token = credentials.credentials
    return verify_token(token)