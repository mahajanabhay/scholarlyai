# NEW
"""
Per-user daily AI usage tracking and enforcement.
"""
from backend.db import get_connection, release_connection

FREE_LIMITS = {
    "chat": 30,
    "quiz": 20,
}

_ALLOWED_KINDS = {"chat", "quiz"}


def get_usage(user_id: str) -> dict:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO usage_limits (user_id, date, chat_count, quiz_count)
            VALUES (%s, CURRENT_DATE, 0, 0)
            ON CONFLICT (user_id) DO UPDATE
                SET date       = CASE WHEN usage_limits.date < CURRENT_DATE
                                      THEN CURRENT_DATE ELSE usage_limits.date END,
                    chat_count = CASE WHEN usage_limits.date < CURRENT_DATE
                                      THEN 0 ELSE usage_limits.chat_count END,
                    quiz_count = CASE WHEN usage_limits.date < CURRENT_DATE
                                      THEN 0 ELSE usage_limits.quiz_count END
            RETURNING chat_count, quiz_count
        """, (user_id,))
        conn.commit()
        row = cur.fetchone()
        return {"chat": row[0], "quiz": row[1]}
    finally:
        release_connection(conn)


def increment_usage(user_id: str, kind: str) -> bool:
    """
    Atomically increments usage counter only if under limit.
    Returns True if allowed, False if limit reached.
    kind: 'chat' | 'quiz'
    """
    if kind not in _ALLOWED_KINDS:
        raise ValueError(f"Invalid usage kind: {kind!r}")

    limit = FREE_LIMITS[kind]
    col   = "chat_count" if kind == "chat" else "quiz_count"

    # Ensure row exists and reset if stale — same upsert as get_usage
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO usage_limits (user_id, date, chat_count, quiz_count)
            VALUES (%s, CURRENT_DATE, 0, 0)
            ON CONFLICT (user_id) DO UPDATE
                SET date       = CASE WHEN usage_limits.date < CURRENT_DATE
                                      THEN CURRENT_DATE ELSE usage_limits.date END,
                    chat_count = CASE WHEN usage_limits.date < CURRENT_DATE
                                      THEN 0 ELSE usage_limits.chat_count END,
                    quiz_count = CASE WHEN usage_limits.date < CURRENT_DATE
                                      THEN 0 ELSE usage_limits.quiz_count END
        """, (user_id,))

        # Atomic conditional increment — only bumps if still under limit.
        # No separate SELECT avoids TOCTOU race under concurrent requests.
        if col == "chat_count":
            cur.execute("""
                UPDATE usage_limits
                SET chat_count = chat_count + 1
                WHERE user_id = %s AND chat_count < %s
                RETURNING chat_count
            """, (user_id, limit))
        else:
            cur.execute("""
                UPDATE usage_limits
                SET quiz_count = quiz_count + 1
                WHERE user_id = %s AND quiz_count < %s
                RETURNING quiz_count
            """, (user_id, limit))

        allowed = cur.fetchone() is not None
        conn.commit()
        return allowed
    finally:
        release_connection(conn)