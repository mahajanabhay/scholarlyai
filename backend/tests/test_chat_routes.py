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


def test_chat_requires_auth(client):
    r = client.post("/chat", data={
        "message": "explain gravity",
        "session_id": "test123",
        "mode": "LEARN",
    })
    assert r.status_code in (401, 403)


def test_sessions_requires_auth(client):
    r = client.get("/chat/sessions")
    assert r.status_code in (401, 403)


def test_delete_session_requires_auth(client):
    r = client.delete("/chat/session/sess123")
    assert r.status_code in (401, 403)


def test_obviously_non_academic_patterns():
    from backend.routes.chat_routes import _is_obviously_non_academic
    assert _is_obviously_non_academic("tell me a joke") is True
    assert _is_obviously_non_academic("explain newton's laws") is False
    assert _is_obviously_non_academic("genshin impact guide") is True