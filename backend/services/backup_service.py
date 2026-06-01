"""
backup_service.py — retained as a no-op stub.

All user data (XP, planners, weaknesses, notifications, streaks) now persists
directly to PostgreSQL via memory_service write-through. JSON backup is no
longer used and these functions are safe to call but do nothing.
"""

def backup_user_data(*args, **kwargs) -> None:
    pass  # No-op: data is persisted to DB on every write

def restore_user_data() -> dict:
    return {}  # No-op: memory_service loads from DB on first access