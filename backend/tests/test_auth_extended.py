import pytest
from unittest.mock import patch, MagicMock


@pytest.fixture
def client():
    with patch("backend.core.config.GROQ_API_KEY", "test_key"), \
         patch("backend.db._init_pool"), \
         patch("backend.db.connection_pool", MagicMock()):
        from backend.app import app
        from fastapi.testclient import TestClient
        return TestClient(app)


@pytest.fixture
def db_mock():
    cur = MagicMock()
    cur.fetchone.return_value = None
    conn = MagicMock()
    conn.cursor.return_value = cur
    return conn, cur


def test_verify_email_invalid_token(client, db_mock):
    conn, cur = db_mock
    with patch("backend.db.get_connection", return_value=conn), \
         patch("backend.db.release_connection"):
        r = client.get("/auth/verify-email?token=invalidtoken123")
        assert r.status_code == 400


def test_forgot_password_always_returns_200(client, db_mock):
    conn, cur = db_mock
    with patch("backend.db.get_connection", return_value=conn), \
         patch("backend.db.release_connection"):
        r = client.post("/auth/forgot-password", data={"email": "nonexistent@test.com"})
        assert r.status_code == 200
        assert "sent" in r.json()["status"].lower()


def test_reset_password_invalid_token(client, db_mock):
    conn, cur = db_mock
    with patch("backend.db.get_connection", return_value=conn), \
         patch("backend.db.release_connection"):
        r = client.post("/auth/reset-password", data={
            "token": "invalidtoken",
            "new_password": "newpassword123"
        })
        assert r.status_code == 400


def test_reset_password_too_short(client):
    r = client.post("/auth/reset-password", data={
        "token": "anytoken",
        "new_password": "short"
    })
    assert r.status_code == 400


def test_resend_verification_requires_valid_email(client, db_mock):
    conn, cur = db_mock
    with patch("backend.db.get_connection", return_value=conn), \
         patch("backend.db.release_connection"):
        r = client.post("/auth/resend-verification", data={"email": "nobody@test.com"})
        assert r.status_code == 404