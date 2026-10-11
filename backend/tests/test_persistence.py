import base64
from dataclasses import replace
from urllib.parse import parse_qs, urlsplit

import pytest
from botocore.stub import ANY, Stubber
from fastapi import HTTPException
from sqlalchemy.dialects import postgresql
from sqlalchemy.pool import NullPool
from sqlmodel import Session, select

from app.core.config import settings
from app.db.engine import build_engine
from app.db.queries import post_tag_filter
from app.models import Photo, Post
from app.services.photo_storage import R2PhotoStorage, get_photo_storage
from scripts.migrate_to_neon_r2 import photo_object, read_source


IMAGE = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j89kAAAAASUVORK5CYII=")


def headers(auth):
    return {"Authorization": f"Bearer {auth['token']}"}


@pytest.fixture
def remote(environment):
    client, engine, _, app, auth = environment
    storage = R2PhotoStorage(replace(settings, photo_storage="r2", r2_account_id="test-account", r2_access_key_id="test-key", r2_secret_access_key="test-secret", r2_bucket_name="test-bucket"))
    app.dependency_overrides[get_photo_storage] = lambda: storage
    with Stubber(storage.client) as stub:
        yield client, engine, storage, stub, auth
        stub.assert_no_pending_responses()


def test_neon_connection_configuration():
    engine = build_engine("postgres://owner:test@sample-pooler.example.test/blog")
    assert engine.url.drivername == "postgresql+psycopg"
    assert engine.url.query["sslmode"] == "require"
    assert isinstance(engine.pool, NullPool)
    engine.dispose()


def test_production_rejects_local_persistence():
    with pytest.raises(RuntimeError, match="Neon PostgreSQL"):
        replace(settings, deployed=True).validate_runtime()
    with pytest.raises(RuntimeError, match="PHOTO_STORAGE=r2"):
        replace(settings, deployed=True, database_url="postgresql://example/db").validate_runtime()
    with pytest.raises(RuntimeError, match="Missing R2 configuration"):
        replace(settings, photo_storage="r2", r2_account_id="", r2_access_key_id="", r2_secret_access_key="", r2_bucket_name="").validate_runtime()


def test_missing_photo_storage_does_not_block_registration(environment, monkeypatch):
    from fastapi.testclient import TestClient
    from app import main
    from app.services import photo_storage

    production = replace(
        settings, deployed=True, database_url="postgresql://example/db",
        photo_storage="r2", r2_account_id="", r2_access_key_id="",
        r2_secret_access_key="", r2_bucket_name="",
    )
    monkeypatch.setattr(main, "settings", production)
    monkeypatch.setattr(photo_storage, "settings", production)
    get_photo_storage.cache_clear()
    try:
        # The environment fixture keeps database I/O in a temporary test database.
        with TestClient(main.create_app()) as client:
            assert client.get("/api/health").status_code == 200
            result = client.post("/api/auth/register", json={
                "email": "new@example.test", "username": "new-user", "password": "test-password",
            })
            assert result.status_code == 201
            login = client.post("/api/auth/login", json={
                "email": "new@example.test", "password": "test-password",
            })
            assert login.status_code == 200
            response = client.post("/api/photos/upload-url", headers=headers(login.json()), json={
                "filename": "p.png", "content_type": "image/png", "size": len(IMAGE),
            })
            assert response.status_code == 503
            assert response.json()["detail"] == "Photo storage is not configured"
    finally:
        get_photo_storage.cache_clear()


def test_local_upload_read_delete_and_ownership(environment):
    client, _, storage, _, auth = environment
    prepare = client.post("/api/photos/upload-url", headers=headers(auth), json={"filename": "photo.png", "content_type": "image/png", "size": len(IMAGE)})
    assert prepare.json() == {"storage": "local"}
    created = client.post("/api/photos", headers=headers(auth), data={"title": "测试相册", "description": "__album:test__"}, files={"file": ("photo.png", IMAGE, "image/png")})
    assert created.status_code == 201
    photo = created.json()
    filename = photo["image_url"]
    assert (storage.directory / filename).read_bytes() == IMAGE
    assert client.get(f"/api/photos/file/{filename}").content == IMAGE
    other = client.post("/api/auth/register", json={"email": "other@example.test", "username": "other", "password": "test-password"}).json()
    assert client.delete(f"/api/photos/{photo['id']}", headers=headers(other)).status_code == 404
    assert client.delete(f"/api/photos/{photo['id']}", headers=headers(auth)).status_code == 204
    assert client.get(f"/api/photos/file/{filename}").status_code == 404


def test_chinese_tag_search_and_totals(environment):
    client, engine, _, _, auth = environment
    with Session(engine) as session:
        session.add(Post(owner_id=auth["user"]["id"], title="中文文章", content="Hello", tags=["生活", "生活日记", "Python"]))
        session.add(Post(owner_id=auth["user"]["id"], title="其他文章", content="world", tags=["技术"]))
        session.commit()
    for path in ["/api/posts", "/api/public/owner/posts"]:
        response = client.get(path, params={"tag": "生活"}, headers=headers(auth))
        assert response.status_code == 200
        assert response.json()["total"] == 1
        assert response.json()["posts"][0]["title"] == "中文文章"
        assert client.get(path, params={"tag": "python", "keyword": "hello"}, headers=headers(auth)).json()["total"] == 1


def test_duplicate_database_completion_preserves_the_existing_file(environment):
    from app.api.routes import _save_photo
    client, engine, storage, _, auth = environment
    created = client.post("/api/photos", headers=headers(auth), data={"title": "first"}, files={"file": ("photo.png", IMAGE, "image/png")}).json()
    filename = created["image_url"]
    with Session(engine) as session:
        with pytest.raises(HTTPException) as error:
            _save_photo(session, storage, auth["user"]["id"], filename, "duplicate", "")
        assert error.value.status_code == 409
    assert (storage.directory / filename).read_bytes() == IMAGE


def test_postgres_tag_query_uses_array_elements():
    engine = build_engine("postgresql://owner:test@example.test/blog")
    with Session(engine) as session:
        query = select(Post).where(post_tag_filter(session, "生活"))
        compiled = str(query.compile(dialect=postgresql.dialect()))
    assert "jsonb_array_elements_text" in compiled
    assert "CAST(post.tags AS JSONB)" in compiled
    engine.dispose()


def test_direct_r2_upload_completion_download_and_delete(remote):
    client, engine, storage, stub, auth = remote
    prepared = client.post("/api/photos/upload-url", headers=headers(auth), json={"filename": "photo.png", "content_type": "image/png", "size": len(IMAGE)})
    assert prepared.status_code == 200
    upload = prepared.json()
    filename = upload["filename"]
    assert filename.startswith(f"{auth['user']['id']}_")
    query = parse_qs(urlsplit(upload["upload_url"]).query)
    assert query["X-Amz-Expires"] == ["300"]
    assert "content-type" in query["X-Amz-SignedHeaders"][0]
    stub.add_response("head_object", {"ContentLength": len(IMAGE), "ContentType": "image/png"}, {"Bucket": storage.bucket, "Key": filename})
    completed = client.post("/api/photos/complete", headers=headers(auth), json={"filename": filename, "title": "云端照片"})
    assert completed.status_code == 201
    photo = completed.json()
    assert client.post("/api/photos/complete", headers=headers(auth), json={"filename": filename, "title": "duplicate"}).status_code == 409
    stub.add_response("head_object", {"ContentLength": len(IMAGE)}, {"Bucket": storage.bucket, "Key": filename})
    download = client.get(f"/api/photos/file/{filename}", follow_redirects=False)
    assert download.status_code == 307
    assert download.headers["cache-control"] == "no-store"
    assert "X-Amz-Signature=" in download.headers["location"]
    stub.add_response("delete_object", {}, {"Bucket": storage.bucket, "Key": filename})
    assert client.delete(f"/api/photos/{photo['id']}", headers=headers(auth)).status_code == 204
    with Session(engine) as session:
        assert session.get(Photo, photo["id"]) is None


def test_r2_rejects_another_users_completion(remote):
    client, _, _, _, auth = remote
    result = client.post("/api/photos/complete", headers=headers(auth), json={"filename": f"999_{'a' * 32}.jpg", "title": "not mine"})
    assert result.status_code == 403


def test_oversized_r2_object_is_removed(remote):
    client, _, storage, stub, auth = remote
    filename = f"{auth['user']['id']}_{'a' * 32}.png"
    stub.add_response("head_object", {"ContentLength": storage.max_bytes + 1, "ContentType": "image/png"}, {"Bucket": storage.bucket, "Key": filename})
    stub.add_response("delete_object", {}, {"Bucket": storage.bucket, "Key": filename})
    response = client.post("/api/photos/complete", headers=headers(auth), json={"filename": filename, "title": "too big"})
    assert response.status_code == 413


def test_storage_errors_do_not_leak_credentials(remote):
    client, _, storage, stub, _ = remote
    stub.add_client_error("head_object", "AccessDenied", "sensitive upstream error", 403, expected_params={"Bucket": storage.bucket, "Key": "test.png"})
    response = client.get("/api/photos/file/test.png", follow_redirects=False)
    assert response.status_code == 503
    assert "sensitive" not in response.text
    stub.add_client_error("head_object", "NoSuchKey", http_status_code=404, expected_params={"Bucket": storage.bucket, "Key": "missing.png"})
    assert client.get("/api/photos/file/missing.png").status_code == 404


def test_r2_server_upload_compatibility(remote):
    client, _, storage, stub, auth = remote
    stub.add_response("put_object", {}, {"Bucket": storage.bucket, "Key": ANY, "Body": IMAGE, "ContentType": "image/png"})
    assert client.post("/api/photos", headers=headers(auth), data={"title": "server upload"}, files={"file": ("p.png", IMAGE, "image/png")}).status_code == 201


def test_upload_authentication_and_validation(environment):
    client, _, storage, _, auth = environment
    body = {"filename": "p.png", "content_type": "image/png", "size": len(IMAGE)}
    assert client.post("/api/photos/upload-url", json=body).status_code == 401
    body["size"] = 21 * 1024 * 1024
    assert client.post("/api/photos/upload-url", headers=headers(auth), json=body).status_code == 422
    assert client.post("/api/photos", headers=headers(auth), data={"title": "bad"}, files={"file": ("p.svg", b"<svg/>", "image/svg+xml")}).status_code == 415
    with pytest.raises(HTTPException):
        storage.response("../private.env")


def test_data_url_migration_conversion_is_repeatable(tmp_path):
    row = {"id": 12, "owner_id": 7, "image_url": "data:image/png;base64," + base64.b64encode(IMAGE).decode()}
    first = photo_object(row, tmp_path)
    assert first == photo_object(row, tmp_path)
    assert first[1:] == (IMAGE, "image/png")
    assert first[0].startswith("7_")


def test_source_migration_preserves_typed_json_and_ids(tmp_path):
    path = tmp_path / "source.db"
    engine = build_engine(f"sqlite:///{path}")
    from sqlmodel import SQLModel
    from app.models import User
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(User(id=45, email="source@example.test", username="source", password_hash="hash", session_token="source-token"))
        session.add(Post(id=51, owner_id=45, title="source", content="content", tags=["中文"]))
        session.commit()
    engine.dispose()
    rows = read_source(path)
    assert rows["user"][0]["id"] == 45
    assert rows["post"][0]["tags"] == ["中文"]
