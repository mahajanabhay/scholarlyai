"""
Proactive notification scheduler.
Call schedule_daily_notifications() once per day from a background task.
"""
from datetime import date, timedelta
from backend.services.memory_service import get_streak, push_notification
from backend.db import get_connection, release_connection


def send_streak_warnings():
    """Warn users whose streak expires tonight if they haven't studied today."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        today = date.today().isoformat()
        yesterday = (date.today() - timedelta(days=1)).isoformat()

        # Users with active streak who haven't touched it today
        cur.execute("""
            SELECT user_id FROM user_streaks
            WHERE last_active = %s
            AND (current)::int > 0
        """, (yesterday,))
        rows = cur.fetchall()

        for (user_id,) in rows:
            push_notification(
                user_id,
                "⚠️ Your streak expires tonight! Study something today to keep it alive 🔥",
                "streak_warning"
            )
    except Exception as e:
        print(f"⚠️ streak warning error: {e}")
    finally:
        release_connection(conn)


def send_inactivity_reminders():
    """Remind users who haven't studied in 2+ days."""
    conn = get_connection()
    try:
        cur = conn.cursor()
        two_days_ago = (date.today() - timedelta(days=2)).isoformat()

        cur.execute("""
            SELECT id FROM users
            WHERE id IN (
                SELECT user_id FROM user_streaks
                WHERE last_active <= %s
            )
        """, (two_days_ago,))
        rows = cur.fetchall()

        for (user_id,) in rows:
            push_notification(
                user_id,
                "📚 You haven't studied in 2+ days. Even 10 minutes today keeps your momentum going!",
                "inactivity"
            )
    except Exception as e:
        print(f"⚠️ inactivity reminder error: {e}")
    finally:
        release_connection(conn)


def schedule_daily_notifications():
    """Run all daily notification jobs."""
    send_streak_warnings()
    send_inactivity_reminders()