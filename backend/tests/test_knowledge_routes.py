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


def test_delete_rejects_path_traversal(client):
    from backend.app import app
    from backend.core.jwt_auth import get_current_user

    app.dependency_overrides[get_current_user] = lambda: {"user_id": "test_user"}
    r = client.delete("/knowledge/documents/..passwd")
    app.dependency_overrides.clear()

    assert r.status_code == 400


def test_upload_rejects_non_pdf(client):
    from backend.app import app
    from backend.core.jwt_auth import get_current_user
    import io

    app.dependency_overrides[get_current_user] = lambda: {"user_id": "test_user"}
    r = client.post(
        "/knowledge/upload",
        files={"file": ("notes.txt", io.BytesIO(b"hello"), "text/plain")},
    )
    app.dependency_overrides.clear()

    assert r.status_code == 400


def test_upload_rejects_fake_pdf_extension(client):
    from backend.app import app
    from backend.core.jwt_auth import get_current_user
    import io

    app.dependency_overrides[get_current_user] = lambda: {"user_id": "test_user"}
    r = client.post(
        "/knowledge/upload",
        files={"file": ("fake.pdf", io.BytesIO(b"not a real pdf"), "application/pdf")},
    )
    app.dependency_overrides.clear()

    assert r.status_code == 400