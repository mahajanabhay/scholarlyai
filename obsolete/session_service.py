from datetime import datetime, timedelta
from typing import Optional
import uuid

class SessionService:
    def __init__(self, db_connection):
        self.db = db_connection

    def create_session(self, user_id: str, token_jti: str, expires_at: datetime, 
                      ip_address: Optional[str] = None, user_agent: Optional[str] = None):
        """Create a new session"""
        query = """
        INSERT INTO sessions (user_id, token_jti, created_at, expires_at, ip_address, user_agent)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id
        """
        try:
            result = self.db.execute(query, (
                user_id, token_jti, datetime.utcnow(), expires_at, ip_address, user_agent
            ))
            return result
        except Exception as e:
            print(f"Error creating session: {e}")
            return None

    def get_user_sessions(self, user_id: str):
        """Get all active sessions for a user"""
        query = """
        SELECT * FROM sessions 
        WHERE user_id = %s AND revoked_at IS NULL AND expires_at > NOW()
        ORDER BY created_at DESC
        """
        try:
            return self.db.fetchall(query, (user_id,))
        except Exception as e:
            print(f"Error fetching sessions: {e}")
            return []

    def revoke_session(self, session_id: str):
        """Revoke a specific session"""
        query = "UPDATE sessions SET revoked_at = %s WHERE id = %s"
        try:
            self.db.execute(query, (datetime.utcnow(), session_id))
        except Exception as e:
            print(f"Error revoking session: {e}")

    def revoke_all_user_sessions(self, user_id: str):
        """Revoke all sessions for a user (logout everywhere)"""
        query = "UPDATE sessions SET revoked_at = %s WHERE user_id = %s AND revoked_at IS NULL"
        try:
            self.db.execute(query, (datetime.utcnow(), user_id))
        except Exception as e:
            print(f"Error revoking all sessions: {e}")

    def cleanup_expired_sessions(self):
        """Remove expired sessions (run periodically)"""
        query = "DELETE FROM sessions WHERE expires_at < NOW()"
        try:
            self.db.execute(query)
        except Exception as e:
            print(f"Error cleaning up sessions: {e}")