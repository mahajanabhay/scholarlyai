import pytest
from unittest.mock import patch, MagicMock
from backend.auth import hash_password, verify_password


def test_password_min_length():
    from backend.auth import register_user
    with patch("backend.auth.user_exists", return_value=False):
        ok, msg = register_user("a@b.com", "Test", "short")
        assert ok is False
        assert "8" in msg


def test_password_exactly_8_chars():
    from backend.auth import register_user
    with patch("backend.auth.user_exists", return_value=False), \
         patch("backend.auth.save_user"), \
         patch("backend.auth.get_connection", return_value=MagicMock()), \
         patch("backend.auth.release_connection"), \
         patch("backend.email_service.send_verification_email"):
        ok, msg = register_user("a@b.com", "Test", "exactly8")
        assert ok is True


def test_duplicate_email():
    from backend.auth import register_user
    with patch("backend.auth.user_exists", return_value=True):
        ok, msg = register_user("existing@b.com", "Test", "password123")
        assert ok is False
        assert "exists" in msg.lower()


def test_authenticate_wrong_password():
    from backend.auth import authenticate_user
    mock_user = MagicMock()
    mock_user.password_hash = hash_password("correctpass")
    with patch("backend.auth.get_user_by_email", return_value=mock_user), \
         patch("backend.auth.check_email_verified", return_value=True):
        ok, msg, user = authenticate_user("a@b.com", "wrongpass")
        assert ok is False


def test_authenticate_unverified_email():
    import pytest
    pytest.skip("Email verification disabled for beta")


def test_authenticate_success():
    from backend.auth import authenticate_user
    mock_user = MagicMock()
    mock_user.password_hash = hash_password("pass12345")
    with patch("backend.auth.get_user_by_email", return_value=mock_user), \
         patch("backend.auth.check_email_verified", return_value=True):
        ok, msg, user = authenticate_user("a@b.com", "pass12345")
        assert ok is True