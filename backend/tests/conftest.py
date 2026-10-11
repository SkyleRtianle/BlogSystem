import os
import sys
from dataclasses import replace
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["PHOTO_STORAGE"] = "local"
os.environ["APP_ENV"] = "development"
os.environ["VERCEL_ENV"] = "development"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import create_engine

from app.core.config import settings
from app.db import session as db_session
from app.main import create_app
from app.services.photo_storage import LocalPhotoStorage, get_photo_storage


@pytest.fixture
def environment(tmp_path, monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    monkeypatch.setattr(db_session, "engine", engine)
    storage = LocalPhotoStorage(replace(settings, photo_upload_dir=tmp_path / "photos"))
    app = create_app()
    app.dependency_overrides[get_photo_storage] = lambda: storage
    with TestClient(app) as client:
        response = client.post("/api/auth/register", json={"email": "owner@example.test", "username": "owner", "password": "test-password"})
        assert response.status_code == 201
        auth = response.json()
        yield client, engine, storage, app, auth
    engine.dispose()
