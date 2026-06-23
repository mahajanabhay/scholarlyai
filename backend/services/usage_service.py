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
    Atomically increments usage counter.
    Returns True if allowed, False if limit reached.
    """
    if kind not in FREE_LIMITS:
        return False

    limit = FREE_LIMITS[kind]

    conn = get_connection()
    try:
        cur = conn.cursor()
        if kind == "chat":
            cur.execute("""
                INSERT INTO usage_limits (user_id, date, chat_count, quiz_count)
                VALUES (%s, CURRENT_DATE, 1, 0)
                ON CONFLICT (user_id) DO UPDATE
                    SET date       = CASE WHEN usage_limits.date < CURRENT_DATE THEN CURRENT_DATE ELSE usage_limits.date END,
                        chat_count = CASE WHEN usage_limits.date < CURRENT_DATE THEN 0 ELSE usage_limits.chat_count END,
                        quiz_count = CASE WHEN usage_limits.date < CURRENT_DATE THEN 0 ELSE usage_limits.quiz_count END
                RETURNING chat_count, quiz_count, date
            """, (user_id,))
        else:
            cur.execute("""
                INSERT INTO usage_limits (user_id, date, chat_count, quiz_count)
                VALUES (%s, CURRENT_DATE, 0, 1)
                ON CONFLICT (user_id) DO UPDATE
                    SET date       = CASE WHEN usage_limits.date < CURRENT_DATE THEN CURRENT_DATE ELSE usage_limits.date END,
                        chat_count = CASE WHEN usage_limits.date < CURRENT_DATE THEN 0 ELSE usage_limits.chat_count END,
                        quiz_count = CASE WHEN usage_limits.date < CURRENT_DATE THEN 0 ELSE usage_limits.quiz_count END
                RETURNING chat_count, quiz_count, date
            """, (user_id,))
        conn.commit()
        row = cur.fetchone()
        current = row[0] if kind == "chat" else row[1]

        if current > limit:
            return False

        if kind == "chat":
            cur.execute("""
                UPDATE usage_limits
                SET chat_count = chat_count + 1
                WHERE user_id = %s
                  AND date = CURRENT_DATE
                  AND chat_count < %s
                RETURNING chat_count
            """, (user_id, limit))
        else:
            cur.execute("""
                UPDATE usage_limits
                SET quiz_count = quiz_count + 1
                WHERE user_id = %s
                  AND date = CURRENT_DATE
                  AND quiz_count < %s
                RETURNING quiz_count
            """, (user_id, limit))
        row = cur.fetchone()
        conn.commit()
        return row is not None
    finally:
        release_connection(conn)