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


def test_upload_requires_auth(client):
    r = client.post("/knowledge/upload")
    assert r.status_code in (401, 403)


def test_list_requires_auth(client):
    r = client.get("/knowledge/documents")
    assert r.status_code in (401, 403)


def test_delete_requires_auth(client):
    r = client.delete("/knowledge/documents/test.pdf")
    assert r.status_code in (401, 403)