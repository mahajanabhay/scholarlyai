import pytest
from unittest.mock import patch, MagicMock, call


def _make_conn(rows):
    cur = MagicMock()
    cur.fetchall.return_value = rows
    conn = MagicMock()
    conn.cursor.return_value = cur
    return conn, cur


def test_streak_warnings_pushes_notification():
    conn, cur = _make_conn([("user_abc",)])
    with patch("backend.services.notification_scheduler.get_connection", return_value=conn), \
         patch("backend.services.notification_scheduler.release_connection"), \
         patch("backend.services.notification_scheduler.push_notification") as mock_push, \
         patch("backend.services.notification_scheduler._get_user_email", return_value=("a@b.com", "Test")), \
         patch("backend.services.notification_scheduler._send_notification_email"):
        from backend.services.notification_scheduler import send_streak_warnings
        send_streak_warnings()
        mock_push.assert_called_once()


def test_inactivity_reminder_pushes_notification():
    conn, cur = _make_conn([("user_xyz",)])
    with patch("backend.services.notification_scheduler.get_connection", return_value=conn), \
         patch("backend.services.notification_scheduler.release_connection"), \
         patch("backend.services.notification_scheduler.push_notification") as mock_push, \
         patch("backend.services.notification_scheduler._get_user_email", return_value=("a@b.com", "Test")), \
         patch("backend.services.notification_scheduler._send_notification_email"):
        from backend.services.notification_scheduler import send_inactivity_reminders
        send_inactivity_reminders()
        mock_push.assert_called_once()


def test_schedule_daily_calls_both():
    with patch("backend.services.notification_scheduler.send_streak_warnings") as sw, \
         patch("backend.services.notification_scheduler.send_inactivity_reminders") as si:
        from backend.services.notification_scheduler import schedule_daily_notifications
        schedule_daily_notifications()
        sw.assert_called_once()
        si.assert_called_once()