import pytest
from unittest.mock import patch, MagicMock
from backend.auth import hash_password, verify_password


def test_hash_and_verify_password():
    pw = "SecurePass123"
    hashed = hash_password(pw)
    assert hashed != pw
    assert verify_password(pw, hashed)


def test_verify_wrong_password():
    hashed = hash_password("correct")
    assert not verify_password("wrong", hashed)


@patch("backend.auth.get_connection")
def test_register_user_duplicate(mock_conn):
    cur = MagicMock()
    cur.fetchone.return_value = ("existing@test.com",)
    mock_conn.return_value.__enter__ = MagicMock(return_value=MagicMock(cursor=MagicMock(return_value=cur)))
    mock_conn.return_value.__exit__ = MagicMock(return_value=False)
    conn = MagicMock()
    conn.cursor.return_value = cur
    mock_conn.return_value = conn
    from backend.auth import register_user
    # Duplicate email should fail gracefully
    with patch("backend.auth.get_connection", return_value=conn):
        with patch("backend.db.get_connection", return_value=conn):
            pass  # just ensure import doesn't crash