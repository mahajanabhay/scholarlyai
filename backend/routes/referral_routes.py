"""
Referral system — generate codes, track usage, reward referrers.
"""
import secrets
from fastapi import APIRouter, Depends, HTTPException, Request
from backend.core.limiter import limiter
from backend.core.jwt_auth import get_current_user
from backend.db import get_connection, release_connection
from backend.services.memory_service import add_xp, push_notification

router = APIRouter()

REFERRAL_XP_REWARD = 100  # XP awarded to referrer on successful signup


@router.post("/referral/generate")
@limiter.limit("10/hour")
async def generate_referral_code(request: Request, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    conn = get_connection()
    try:
        cur = conn.cursor()
        # Return existing unused code if available
        cur.execute(
            "SELECT code FROM referrals WHERE referrer_id = %s AND used = FALSE LIMIT 1",
            (user_id,)
        )
        row = cur.fetchone()
        if row:
            return {"code": row[0], "url": f"/signup?ref={row[0]}"}

        code = secrets.token_urlsafe(8)
        cur.execute(
            "INSERT INTO referrals (referrer_id, code) VALUES (%s, %s)",
            (user_id, code)
        )
        conn.commit()
        return {"code": code, "url": f"/signup?ref={code}"}
    finally:
        release_connection(conn)


@router.get("/referral/stats")
async def get_referral_stats(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT COUNT(*) FROM referrals WHERE referrer_id = %s AND used = TRUE",
            (user_id,)
        )
        total = cur.fetchone()[0]
        cur.execute(
            "SELECT code, used, used_at FROM referrals WHERE referrer_id = %s ORDER BY created_at DESC LIMIT 10",
            (user_id,)
        )
        rows = cur.fetchall()
        return {
            "total_referrals": total,
            "xp_earned":       total * REFERRAL_XP_REWARD,
            "codes": [{"code": r[0], "used": r[1], "used_at": str(r[2]) if r[2] else None} for r in rows],
        }
    finally:
        release_connection(conn)


def redeem_referral(code: str, new_user_id: str):
    """Call after successful registration if a ref code was provided."""
    if not code:
        return
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, referrer_id FROM referrals WHERE code = %s AND used = FALSE",
            (code,)
        )
        row = cur.fetchone()
        if not row:
            return
        cur.execute(
            """UPDATE referrals SET used = TRUE, referred_id = %s, used_at = NOW()
               WHERE id = %s""",
            (new_user_id, row[0])
        )
        conn.commit()
        # Reward referrer
        add_xp(row[1], REFERRAL_XP_REWARD)
        push_notification(
            row[1],
            f"🎉 Someone signed up with your referral link! +{REFERRAL_XP_REWARD} XP earned.",
            "referral"
        )
    except Exception as e:
        print(f"⚠️ referral redemption error: {e}")
    finally:
        release_connection(conn)