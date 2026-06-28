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


def test_register_user_duplicate():
    from backend.auth import register_user
    conn = MagicMock()
    cur = MagicMock()
    cur.fetchone.return_value = ("existing@test.com",)
    conn.cursor.return_value = cur

    with patch("backend.auth.get_connection", return_value=conn):
        success, message = register_user("existing@test.com", "Test User", "password123")

    assert success is False
    assert "exist" in message.lower() or "duplicate" in message.lower() or "already" in message.lower()