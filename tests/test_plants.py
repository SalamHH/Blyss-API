import os

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["ENVIRONMENT"] = "local"
os.environ["RATE_LIMIT_AUTH_REQUESTS_PER_WINDOW"] = "100"
os.environ["AUTH_JWT_SECRET"] = "test-jwt-secret"
os.environ["AUTH_OTP_SECRET"] = "test-otp-secret"

from app.database.base import Base
from app.database.session import get_db
from app.main import app


def _build_test_client() -> TestClient:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False, class_=Session)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


def test_plants_crud_happy_path() -> None:
    client = _build_test_client()
    headers = {"X-User-Id": "1"}

    created = client.post("/api/v1/plants", json={"name": "Monstera", "species": "Monstera deliciosa"}, headers=headers)
    assert created.status_code == 201
    plant = created.json()
    plant_id = plant["id"]
    assert plant["owner_id"] == 1
    assert plant["name"] == "Monstera"
    assert plant["species"] == "Monstera deliciosa"

    listed = client.get("/api/v1/plants", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert listed.json()[0]["id"] == plant_id

    fetched = client.get(f"/api/v1/plants/{plant_id}", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json()["name"] == "Monstera"

    updated = client.patch(
        f"/api/v1/plants/{plant_id}",
        json={"name": "Swiss Cheese Plant"},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Swiss Cheese Plant"

    deleted = client.delete(f"/api/v1/plants/{plant_id}", headers=headers)
    assert deleted.status_code == 204

    listed_after_delete = client.get("/api/v1/plants", headers=headers)
    assert listed_after_delete.status_code == 200
    assert listed_after_delete.json() == []


def test_plants_are_owner_scoped() -> None:
    client = _build_test_client()
    owner_headers = {"X-User-Id": "1"}
    other_headers = {"X-User-Id": "2"}

    created = client.post("/api/v1/plants", json={"name": "Pothos"}, headers=owner_headers)
    assert created.status_code == 201
    plant_id = created.json()["id"]

    other_list = client.get("/api/v1/plants", headers=other_headers)
    assert other_list.status_code == 200
    assert other_list.json() == []

    other_get = client.get(f"/api/v1/plants/{plant_id}", headers=other_headers)
    assert other_get.status_code == 404

    other_patch = client.patch(f"/api/v1/plants/{plant_id}", json={"name": "Hack"}, headers=other_headers)
    assert other_patch.status_code == 404

    other_delete = client.delete(f"/api/v1/plants/{plant_id}", headers=other_headers)
    assert other_delete.status_code == 404


def test_plants_require_user_header() -> None:
    client = _build_test_client()
    response = client.get("/api/v1/plants")
    assert response.status_code == 401
    assert response.json()["detail"] == "Missing X-User-Id header"
