import pytest
from unittest.mock import patch, MagicMock


@pytest.fixture(scope="module")
def client():
    with patch("backend.core.config.GROQ_API_KEY", "test_key"), \
         patch("backend.db._init_pool"), \
         patch("backend.db.connection_pool", MagicMock()), \
         patch("backend.app.init_db"):
        from backend.app import app
        from fastapi.testclient import TestClient
        with TestClient(app) as c:
            yield c


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


def test_chat_history_returns_messages():
    from backend.app import app
    from backend.core.jwt_auth import get_current_user
    from fastapi.testclient import TestClient
    from unittest.mock import AsyncMock

    fake_rows = [{"role": "user", "content": "hi", "created_at": "2026-01-01T00:00:00"}]

    app.dependency_overrides[get_current_user] = lambda: {"user_id": "test_user"}
    with patch("backend.routes.chat_routes.asyncio.to_thread", new=AsyncMock(return_value=fake_rows)):
        with TestClient(app) as c:
            r = c.get("/chat/history/sess123")
    app.dependency_overrides.clear()

    assert r.status_code == 200
    assert r.json() == {"history": fake_rows}