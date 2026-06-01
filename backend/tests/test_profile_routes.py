import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock


@pytest.fixture
def client():
    with patch("backend.db._init_pool"), \
         patch("backend.db.connection_pool", MagicMock()):
        from backend.app import app
        return TestClient(app)


def test_profile_requires_auth(client):
    r = client.get("/profile/some_user")
    assert r.status_code in (401, 403)


def test_change_password_requires_auth(client):
    r = client.post("/auth/change-password", data={
        "current_password": "old", "new_password": "newpass123"
    })
    assert r.status_code in (401, 403)


def test_weaknesses_requires_auth(client):
    r = client.get("/weaknesses/some_user")
    assert r.status_code in (401, 403)