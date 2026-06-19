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
    col   = "chat_count" if kind == "chat" else "quiz_count"

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(f"""
            UPDATE usage_limits
            SET {col} = {col} + 1
            WHERE user_id = %s
              AND date = CURRENT_DATE
              AND {col} < %s
            RETURNING {col}
        """, (user_id, limit))
        row = cur.fetchone()
        if row:
            conn.commit()
            return True

        # Check if row exists for today
        cur.execute("""
            SELECT 1 FROM usage_limits
            WHERE user_id = %s AND date = CURRENT_DATE
        """, (user_id,))
        exists = cur.fetchone()

        if not exists:
            # Insert new row for today and count as first use
            cur.execute("""
                INSERT INTO usage_limits (user_id, date, chat_count, quiz_count)
                VALUES (%s, CURRENT_DATE, %s, %s)
                ON CONFLICT (user_id) DO UPDATE
                    SET date = CURRENT_DATE,
                        chat_count = CASE WHEN usage_limits.date < CURRENT_DATE THEN %s ELSE usage_limits.chat_count END,
                        quiz_count = CASE WHEN usage_limits.date < CURRENT_DATE THEN %s ELSE usage_limits.quiz_count END
            """, (
                user_id,
                1 if kind == "chat" else 0,
                1 if kind == "quiz" else 0,
                1 if kind == "chat" else 0,
                1 if kind == "quiz" else 0,
            ))
            conn.commit()
            return True

        # Row exists but limit reached
        return False
    finally:
        release_connection(conn)