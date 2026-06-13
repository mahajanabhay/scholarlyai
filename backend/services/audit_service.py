"""
Audit logging — records security-sensitive actions to the DB.
Never raises — always fails silently to avoid blocking requests.
"""
from backend.db import get_connection, release_connection


def audit(user_id: str | None, action: str, detail: str = "", ip: str = ""):
    try:
        conn = get_connection()
        try:
            cur = conn.cursor()
            cur.execute(
                """INSERT INTO audit_log (user_id, action, detail, ip)
                   VALUES (%s, %s, %s, %s)""",
                (user_id, action, detail[:500], ip[:100])
            )
            conn.commit()
        finally:
            release_connection(conn)
    except Exception as e:
        print(f"⚠️ audit log failed: {e}")