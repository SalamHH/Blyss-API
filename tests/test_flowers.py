import os
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["ENVIRONMENT"] = "local"
os.environ["RATE_LIMIT_AUTH_REQUESTS_PER_WINDOW"] = "100"
os.environ["AUTH_JWT_SECRET"] = "test-jwt-secret"
os.environ["AUTH_OTP_SECRET"] = "test-otp-secret"

from app.database.base import Base
from app.database.models.flower import Flower, FlowerStatus
from app.database.session import get_db
from app.main import app


def _build_test_client() -> tuple[TestClient, sessionmaker[Session]]:
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
    return TestClient(app), testing_session_local


def _auth_headers(client: TestClient, email: str) -> dict[str, str]:
    request_otp = client.post("/api/v1/auth/request-otp", json={"email": email})
    assert request_otp.status_code == 202
    otp = request_otp.json()["debug_otp"]
    assert otp is not None

    verify = client.post("/api/v1/auth/verify-otp", json={"email": email, "otp": otp})
    assert verify.status_code == 200
    token = verify.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_create_and_water_flower() -> None:
    client, _ = _build_test_client()
    headers = _auth_headers(client, "gardener@example.com")

    created = client.post("/api/v1/flowers", json={"title": "For You", "flower_type": "rose"}, headers=headers)
    assert created.status_code == 201
    flower_id = created.json()["id"]
    assert created.json()["status"] == FlowerStatus.growing.value

    watered = client.post(
        f"/api/v1/flowers/{flower_id}/water",
        json={"message": "I am proud of you today", "drop_type": "text"},
        headers=headers,
    )
    assert watered.status_code == 200
    assert watered.json()["day_number"] == 1
    assert watered.json()["flower"]["water_count"] == 1

    duplicate = client.post(
        f"/api/v1/flowers/{flower_id}/water",
        json={"message": "Second try today"},
        headers=headers,
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "Flower already watered today"


def test_send_and_open_flower_by_token() -> None:
    client, session_local = _build_test_client()
    headers = _auth_headers(client, "sender@example.com")

    created = client.post("/api/v1/flowers", json={"title": "Our Bloom"}, headers=headers)
    assert created.status_code == 201
    flower_id = created.json()["id"]

    with session_local() as db:
        flower = db.get(Flower, flower_id)
        assert flower is not None
        flower.status = FlowerStatus.ready.value
        flower.ready_at = datetime.now(UTC)
        db.commit()

    send = client.post(
        f"/api/v1/flowers/{flower_id}/send",
        json={"delivery_mode": "instant", "recipient_name": "Alex"},
        headers=headers,
    )
    assert send.status_code == 200
    share_token = send.json()["share_token"]
    assert share_token
    assert send.json()["sent_at"] is not None

    opened = client.get(f"/api/v1/flowers/open/{share_token}")
    assert opened.status_code == 200
    assert opened.json()["flower_id"] == flower_id
    assert opened.json()["title"] == "Our Bloom"
    assert opened.json()["opened_at"] is not None


def test_open_scheduled_flower_before_delivery_is_blocked() -> None:
    client, session_local = _build_test_client()
    headers = _auth_headers(client, "scheduled@example.com")

    created = client.post("/api/v1/flowers", json={"title": "Open Later"}, headers=headers)
    assert created.status_code == 201
    flower_id = created.json()["id"]

    with session_local() as db:
        flower = db.get(Flower, flower_id)
        assert flower is not None
        flower.status = FlowerStatus.ready.value
        flower.ready_at = datetime.now(UTC)
        db.commit()

    future_time = datetime.now(UTC) + timedelta(days=1)
    send = client.post(
        f"/api/v1/flowers/{flower_id}/send",
        json={"delivery_mode": "scheduled", "scheduled_for": future_time.isoformat()},
        headers=headers,
    )
    assert send.status_code == 200
    share_token = send.json()["share_token"]

    opened = client.get(f"/api/v1/flowers/open/{share_token}")
    assert opened.status_code == 403
    assert opened.json()["detail"] == "Gift is not available yet"
