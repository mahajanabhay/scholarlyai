"""
Per-user daily AI usage tracking and enforcement.
"""
from backend.db import get_connection, release_connection

FREE_LIMITS = {
    "chat": 30,
    "quiz": 20,
}


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
    Increments usage counter. Returns True if allowed, False if limit reached.
    kind: 'chat' | 'quiz'
    """
    usage = get_usage(user_id)
    if usage[kind] >= FREE_LIMITS[kind]:
        return False

    conn = get_connection()
    try:
        cur = conn.cursor()
        col = "chat_count" if kind == "chat" else "quiz_count"
        cur.execute(
            f"UPDATE usage_limits SET {col} = {col} + 1 WHERE user_id = %s",
            (user_id,)
        )
        conn.commit()
        return True
    finally:
        release_connection(conn)