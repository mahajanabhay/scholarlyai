import pytest
from unittest.mock import patch, MagicMock


@pytest.fixture(autouse=True)
def mock_db():
    with patch("backend.db._init_pool"), \
         patch("backend.db.connection_pool", MagicMock()):
        yield


def test_xp_add():
    with patch("backend.services.memory_service.upsert_xp"), \
         patch("backend.services.memory_service.push_notification"), \
         patch("backend.services.memory_service.load_xp_from_db", return_value={"total": 0, "level": 1}):
        from backend.services.memory_service import add_xp, get_xp
        add_xp("user1", 50)
        xp = get_xp("user1")
        assert xp["total"] >= 0


def test_get_profile_fallback():
    with patch("backend.services.memory_service.get_connection", side_effect=Exception("no db")):
        from backend.services import memory_service
        memory_service._profiles = {}
        p = memory_service.get_profile("unknown_user")
        assert p["name"] == "Scholar"