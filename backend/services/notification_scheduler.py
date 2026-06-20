"""
Proactive notification scheduler.
Call schedule_daily_notifications() once per day from a background task.
"""
from datetime import date, timedelta
from backend.services.memory_service import get_streak, push_notification
from backend.db import get_connection, release_connection


def _get_user_email(user_id: str):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT email, name FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()
        return (row[0], row[1]) if row else (None, None)
    finally:
        release_connection(conn)


def _send_notification_email(to_email: str, name: str, subject: str, body: str):
    if not to_email:
        return
    try:
        from backend.email_service import _send_raw_email
        _send_raw_email(to_email, name, subject, body)
    except Exception as e:
        print(f"⚠️ notification email error: {e}")


def send_streak_warnings():
    conn = get_connection()
    try:
        cur = conn.cursor()
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        cur.execute("""
            SELECT user_id FROM user_streaks
            WHERE last_active = %s
            AND (current)::int > 0
        """, (yesterday,))
        rows = cur.fetchall()

        for (user_id,) in rows:
            msg = "⚠️ Your streak expires tonight! Study something today to keep it alive 🔥"
            push_notification(user_id, msg, "streak_warning")
            email, name = _get_user_email(user_id)
            _send_notification_email(
                email, name,
                "Your Clarix streak expires tonight 🔥",
                f"<p>Hi {name},</p><p>{msg}</p><p><a href='$APP_URL'>Study now</a></p>"
            )
    except Exception as e:
        print(f"⚠️ streak warning error: {e}")
    finally:
        release_connection(conn)


def send_inactivity_reminders():
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
            msg = "📚 You haven't studied in 2+ days. Even 10 minutes today keeps your momentum going!"
            push_notification(user_id, msg, "inactivity")
            email, name = _get_user_email(user_id)
            _send_notification_email(
                email, name,
                "We miss you on Clarix 📚",
                f"<p>Hi {name},</p><p>{msg}</p><p><a href='$APP_URL'>Get back on track</a></p>"
            )
    except Exception as e:
        print(f"⚠️ inactivity reminder error: {e}")
    finally:
        release_connection(conn)


def schedule_daily_notifications():
    send_streak_warnings()
    send_inactivity_reminders()