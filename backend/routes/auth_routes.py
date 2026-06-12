import asyncio
from fastapi import APIRouter, Depends, HTTPException, Form, Request, Response
import json
from datetime import date
from backend.auth import User, authenticate_user, get_email_from_user_id, get_user_by_email, get_user_id_from_email
from backend.core.jwt_auth import create_token, get_current_user
from backend.core.limiter import limiter
from backend.services.memory_service import get_streak, push_notification

router = APIRouter()


@router.post("/auth/login")
@limiter.limit("10/minute")
async def login(
    request: Request,
    response: Response,
    email: str = Form(...),
    password: str = Form(...)
):
    """Login user — max 10 attempts per minute per IP"""
    success, message, user = await asyncio.to_thread(authenticate_user, email, password)

    if not success:
        raise HTTPException(status_code=401, detail=message)

    user_id = get_user_id_from_email(email)
    if not user_id:
        raise HTTPException(status_code=500, detail="User ID lookup failed after successful auth")
    token   = create_token(user_id, email)

    # Re-engagement notification for users returning after 2+ days
    try:
        streak = get_streak(user_id)
        last_active = streak.get("last_active")
        if last_active:
            days_away = (date.today() - date.fromisoformat(last_active)).days
            if days_away >= 2:
                push_notification(
                    user_id,
                    f"👋 Welcome back! You were away for {days_away} days — let's get back on track!",
                    "re_engagement"
                )
    except Exception:
        pass

    data = {
        "status":        "authenticated",
        "user_id":       user_id,
        "token":         token,
        "email":         user.email,
        "name":          user.name,
        "avatar":        user.avatar,
        "bio":           user.bio,
        "subject_focus": user.subject_focus,
    }
    response.set_cookie(
        key="scholarly_token",
        value=token,
        httponly=True,
        secure=False,   # set True in production (HTTPS)
        samesite="lax",
        max_age=60 * 60 * 24 * 7
    )
    return data


@router.post("/auth/register")
@limiter.limit("5/minute")
async def register(
    request: Request,
    response: Response,
    email:    str = Form(...),
    password: str = Form(...),
    name:     str = Form(...),
):
    """Register user — max 5 attempts per minute per IP"""
    from backend.auth import register_user
    success, message = register_user(email, name, password)

    if not success:
        raise HTTPException(status_code=400, detail=message)

    user_id = get_user_id_from_email(email)
    if not user_id:
        raise HTTPException(status_code=500, detail="User ID lookup failed after successful registration")
    token   = create_token(user_id, email)

    data = {
        "status":        "registered",
        "user_id":       user_id,
        "token":         token,
        "email":         email,
        "name":          name,
        "avatar":        "🎓",
        "bio":           "",
        "subject_focus": [],
    }
    response.set_cookie(
        key="scholarly_token",
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 24 * 7
    )
    return data


@router.get("/auth/check/{user_id}")
async def check_auth(
    user_id:      str,
    current_user: dict = Depends(get_current_user),
):
    """Check if user_id is valid and get user details"""
    email = get_email_from_user_id(user_id)

    if not email:
        raise HTTPException(status_code=404, detail="User not found")

    user = get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "valid":   True,
        "user_id": user_id,
        "email":   email,
        "name":    user.name,
        "avatar":  user.avatar,
        "bio":     user.bio,
    }

@router.post("/auth/refresh")
async def refresh_token(current_user: dict = Depends(get_current_user)):
    """Issue a fresh token using the existing valid token."""
    new_token = create_token(current_user["user_id"], current_user["email"])
    return {"token": new_token}

@router.get("/auth/verify-email")
async def verify_email(token: str):
    from backend.db import get_connection, release_connection
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, email FROM users WHERE verify_token = %s AND is_verified = FALSE",
            (token,)
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=400, detail="Invalid or expired verification link.")
        cur.execute(
            "UPDATE users SET is_verified = TRUE, verify_token = NULL WHERE id = %s",
            (row[0],)
        )
        conn.commit()
        return {"status": "verified", "email": row[1]}
    finally:
        release_connection(conn)


@router.post("/auth/resend-verification")
@limiter.limit("3/hour")
async def resend_verification(request: Request, email: str = Form(...)):
    import secrets
    from backend.email_service import send_verification_email
    from backend.db import get_connection, release_connection
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, name, is_verified FROM users WHERE email = %s",
            (email.lower().strip(),)
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Email not found.")
        if row[2]:
            raise HTTPException(status_code=400, detail="Email already verified.")
        token = secrets.token_urlsafe(32)
        cur.execute(
            "UPDATE users SET verify_token = %s WHERE id = %s",
            (token, row[0])
        )
        conn.commit()
        send_verification_email(email, row[1], token)
        return {"status": "verification email sent"}
    finally:
        release_connection(conn)

@router.post("/auth/forgot-password")
@limiter.limit("3/hour")
async def forgot_password(request: Request, email: str = Form(...)):
    import secrets
    from backend.email_service import send_password_reset_email
    from backend.db import get_connection, release_connection
    from datetime import datetime, timedelta

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, name FROM users WHERE email = %s", (email.lower().strip(),))
        row = cur.fetchone()

        # Always return success to prevent email enumeration
        if not row:
            return {"status": "If that email exists, a reset link has been sent."}

        token     = secrets.token_urlsafe(32)
        expires   = datetime.utcnow() + timedelta(hours=1)

        cur.execute(
            "UPDATE users SET reset_token = %s, reset_token_expires_at = %s WHERE id = %s",
            (token, expires, row[0])
        )
        conn.commit()
        send_password_reset_email(email, row[1], token)
        return {"status": "If that email exists, a reset link has been sent."}
    finally:
        release_connection(conn)


@router.post("/auth/reset-password")
@limiter.limit("5/hour")
async def reset_password(
    request:      Request,
    token:        str = Form(...),
    new_password: str = Form(...),
):
    from backend.db import get_connection, release_connection
    from backend.auth import hash_password
    from datetime import datetime

    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT id FROM users
               WHERE reset_token = %s
               AND reset_token_expires_at > %s""",
            (token, datetime.utcnow())
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=400, detail="Invalid or expired reset link.")

        cur.execute(
            "UPDATE users SET password_hash = %s, reset_token = NULL, reset_token_expires_at = NULL WHERE id = %s",
            (hash_password(new_password), row[0])
        )
        conn.commit()
        return {"status": "Password reset successfully."}
    finally:
        release_connection(conn)