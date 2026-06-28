import pytest
from unittest.mock import patch, MagicMock


@pytest.fixture(scope="module")
def client():
    with patch("backend.core.config.GROQ_API_KEY", "test_key"), \
         patch("backend.db._init_pool"), \
         patch("backend.db.connection_pool", MagicMock()), \
         patch("backend.db.init_db"):
        from backend.app import app
        from fastapi.testclient import TestClient
        with TestClient(app) as c:
            yield c


def test_quiz_requires_auth(client):
    r = client.post("/quiz", data={
        "message": "photosynthesis",
        "session_id": "test123",
        "mode": "QUIZ",
        "quiz_type": "single",
        "question_number": 1,
        "is_starting": "true",
    })
    assert r.status_code in (401, 403)


def test_quiz_answers_requires_auth(client):
    r = client.post("/quiz/answers", data={
        "session_id": "test123",
        "answers": "{}",
    })
    assert r.status_code in (401, 403)


def test_quiz_reset_requires_auth(client):
    r = client.post("/quiz/reset", data={"session_id": "test123"})
    assert r.status_code in (401, 403)


def test_non_academic_gate():
    from backend.routes.quiz_routes import is_academic_query
    # "fortnite tips" is caught by _is_obviously_non_academic — no LLM call
    assert is_academic_query("fortnite tips") is False

    # Mock the LLM call for the academic path
    mock_resp = MagicMock()
    mock_resp.choices[0].message.content = "ACADEMIC"
    with patch("backend.routes.quiz_routes.client.chat.completions.create", return_value=mock_resp):
        assert is_academic_query("photosynthesis") is True


def test_expand_abbreviations():
    from backend.routes.quiz_routes import expand_abbreviations
    result = expand_abbreviations("ai")
    assert result.lower() != "ai"