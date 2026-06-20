import pytest
from unittest.mock import patch, MagicMock


@pytest.fixture(autouse=True)
def mock_db():
    with patch("backend.db._init_pool"), \
         patch("backend.db.connection_pool", MagicMock()):
        yield


def _make_conn(fetchone_val):
    cur = MagicMock()
    cur.fetchone.return_value = fetchone_val
    conn = MagicMock()
    conn.cursor.return_value = cur
    return conn, cur


def test_increment_allowed():
    conn, cur = _make_conn((1, 0, "2026-01-01"))
    with patch("backend.services.usage_service.get_connection", return_value=conn), \
         patch("backend.services.usage_service.release_connection"):
        from backend.services.usage_service import increment_usage
        result = increment_usage("user1", "chat")
        assert result is True


def test_increment_limit_reached():
    conn, cur = _make_conn((30, 0, "2026-01-01"))
    with patch("backend.services.usage_service.get_connection", return_value=conn), \
         patch("backend.services.usage_service.release_connection"):
        # Simulate UPDATE returning nothing (limit reached)
        cur.fetchone.side_effect = [(30, 0, "2026-01-01"), None]
        from backend.services.usage_service import increment_usage
        result = increment_usage("user1", "chat")
        assert result is False


def test_invalid_kind():
    from backend.services.usage_service import increment_usage
    assert increment_usage("user1", "invalid") is False


def test_get_usage_returns_dict():
    conn, cur = _make_conn((5, 3))
    with patch("backend.services.usage_service.get_connection", return_value=conn), \
         patch("backend.services.usage_service.release_connection"):
        from backend.services.usage_service import get_usage
        result = get_usage("user1")
        assert "chat" in result
        assert "quiz" in result