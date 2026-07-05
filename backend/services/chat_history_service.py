"""
Chat History Service (Production-Ready)
Saves and loads chat messages from PostgreSQL with safety guardrails
"""
from backend.db import get_connection, release_connection


def save_message(user_id: str, session_id: str, role: str, content: str, mode: str = "LEARN") -> None:
    """
    Save a single message to the database.
    
    Args:
        user_id: User identifier (validated by caller)
        session_id: Chat session identifier
        role: "user" or "assistant"
        content: Message content (can be multiline)
        mode: Learning mode (LEARN, QUIZ, SUMMARY, ANALYSIS, CODE)
    """
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO chat_sessions (user_id, session_id, role, content, mode, created_at)
            VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
        """, (user_id, session_id, role, content, mode))
        conn.commit()
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"⚠️  Failed to save message for {user_id}: {e}")
    finally:
        if conn:
            release_connection(conn)


def load_history(user_id: str, session_id: str, limit: int = 20) -> list:
    """
    Load chat history for a session from the database.
    
    Args:
        user_id: User identifier (for ownership validation)
        session_id: Chat session identifier
        limit: Max messages to return (clamped to 1-100 for safety)
    
    Returns:
        List of messages with role, content, mode, and created_at timestamp
    """
    # ✅ FIX 2B: Enforce safety limits (prevent DoS via oversized requests)
    limit = min(max(limit, 1), 100)  # Clamp to 1-100 messages
    
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT role, content, mode, created_at
            FROM chat_sessions
            WHERE user_id = %s AND session_id = %s
            ORDER BY created_at ASC
            LIMIT %s
        """, (user_id, session_id, limit))
        
        rows = cursor.fetchall()
        
        # ✅ FIX 2C: Include created_at in response for frontend timestamps
        history = [
            {
                "role": r[0],
                "content": r[1],
                "mode": r[2],
                "created_at": r[3].isoformat() if r[3] else None
            }
            for r in rows
        ]
        
        return history
        
    except Exception as e:
        print(f"⚠️  Failed to load history for {user_id}:{session_id}: {e}")
        return []
    finally:
        if conn:
            release_connection(conn)


def get_user_sessions(user_id: str) -> list:
    """
    Get all unique session IDs for a user with preview of latest message.
    
    Returns the most recent message from each session for display in sidebar.
    Uses subquery instead of DISTINCT ON for database portability.
    
    Args:
        user_id: User identifier
    
    Returns:
        List of sessions with session_id, preview, mode, and created_at
    """
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # ✅ FIX 2A: Use subquery instead of DISTINCT ON for portability
        # (DISTINCT ON only works in PostgreSQL, not MySQL/SQLite)
        cursor.execute("""
            SELECT session_id, content, mode, created_at
            FROM chat_sessions cs1
            WHERE user_id = %s AND role = 'user'
              AND created_at = (
                  SELECT MAX(created_at) 
                  FROM chat_sessions cs2
                  WHERE cs2.user_id = cs1.user_id 
                    AND cs2.session_id = cs1.session_id
              )
            ORDER BY created_at DESC
        """, (user_id,))
        
        rows = cursor.fetchall()
        
        sessions = [
            {
                "session_id": r[0],
                "preview": (r[1][:60] + "...") if len(r[1]) > 60 else r[1],
                "mode": r[2],
                "created_at": r[3].isoformat() if r[3] else None,
            }
            for r in rows
        ]
        
        print(f"✅ Found {len(sessions)} sessions for {user_id[:8]}")
        return sessions
        
    except Exception as e:
        print(f"⚠️  Failed to get sessions for {user_id}: {e}")
        return []
    finally:
        if conn:
            release_connection(conn)


def delete_session(user_id: str, session_id: str) -> dict:
    """
    Delete all messages in a chat session.
    
    Returns status dict for proper error handling on caller side.
    
    Args:
        user_id: User identifier (for authorization)
        session_id: Session to delete
    
    Returns:
        {"status": "deleted"|"not_found"|"error", "deleted_messages": N, "message": error_str}
    """
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            DELETE FROM chat_sessions
            WHERE user_id = %s AND session_id = %s
        """, (user_id, session_id))
        
        # ✅ FIX 2D: Return rowcount for confirmation
        deleted_count = cursor.rowcount
        conn.commit()
        
        status = "deleted" if deleted_count > 0 else "not_found"
        print(f"✅ Deleted {deleted_count} messages from {user_id[:8]}:{session_id[:8]}")
        
        return {
            "status": status,
            "deleted_messages": deleted_count
        }
        
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"⚠️  Failed to delete session {user_id}:{session_id}: {e}")
        return {
            "status": "error",
            "message": str(e),
            "deleted_messages": 0
        }
    finally:
        if conn:
            release_connection(conn)


# ── OPTIONAL: Helper function for migration/analytics ──
def get_session_message_count(user_id: str, session_id: str) -> int:
    """
    Get total message count for a session (for pagination info).
    Useful for frontend to know if there are more messages beyond the limit.
    """
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COUNT(*) FROM chat_sessions
            WHERE user_id = %s AND session_id = %s
        """, (user_id, session_id))
        count = cursor.fetchone()[0]
        return count
    except Exception as e:
        print(f"⚠️  Failed to get message count: {e}")
        return 0
    finally:
        if conn:
            release_connection(conn)


def get_user_message_stats(user_id: str) -> dict:
    """
    Get aggregate statistics for a user (for dashboard/insights).
    """
    conn = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                COUNT(*) as total_messages,
                COUNT(DISTINCT session_id) as total_sessions,
                COUNT(CASE WHEN role = 'user' THEN 1 END) as user_messages,
                COUNT(CASE WHEN role = 'assistant' THEN 1 END) as assistant_messages,
                MAX(created_at) as last_activity
            FROM chat_sessions
            WHERE user_id = %s
        """, (user_id,))
        
        row = cursor.fetchone()
        if row:
            return {
                "total_messages": row[0] or 0,
                "total_sessions": row[1] or 0,
                "user_messages": row[2] or 0,
                "assistant_messages": row[3] or 0,
                "last_activity": row[4].isoformat() if row[4] else None
            }
        return {
            "total_messages": 0,
            "total_sessions": 0,
            "user_messages": 0,
            "assistant_messages": 0,
            "last_activity": None
        }
    except Exception as e:
        print(f"⚠️  Failed to get user stats: {e}")
        return {}
    finally:
        if conn:
            release_connection(conn)