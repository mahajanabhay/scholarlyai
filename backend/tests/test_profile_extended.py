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


def test_onboarding_complete_requires_auth(client):
    r = client.post("/profile/some_user/onboarding-complete")
    assert r.status_code in (401, 403)


def test_progress_requires_auth(client):
    r = client.get("/profile/some_user/progress")
    assert r.status_code in (401, 403)


def test_papers_requires_auth(client):
    r = client.get("/papers/some_user")
    assert r.status_code in (401, 403)


def test_streak_requires_auth(client):
    r = client.post("/streak/some_user/touch", data={"action": "quiz_complete"})
    assert r.status_code in (401, 403)


def test_streak_invalid_action_requires_auth(client):
    r = client.post("/streak/some_user/touch", data={"action": "invalid_action"})
    assert r.status_code in (401, 403)