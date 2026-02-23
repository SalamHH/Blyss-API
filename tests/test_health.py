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
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, class_=Session)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


def test_root() -> None:
    client = _build_test_client()
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_health() -> None:
    client = _build_test_client()
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_me_requires_bearer_token() -> None:
    client = _build_test_client()
    response = client.get("/api/v1/me")
    assert response.status_code == 401


def test_otp_login_and_me_flow() -> None:
    client = _build_test_client()

    request_otp = client.post("/api/v1/auth/request-otp", json={"email": "user@example.com"})
    assert request_otp.status_code == 202

    debug_otp = request_otp.json()["debug_otp"]
    assert debug_otp is not None

    verify = client.post(
        "/api/v1/auth/verify-otp",
        json={"email": "user@example.com", "otp": debug_otp},
    )
    assert verify.status_code == 200

    access_token = verify.json()["access_token"]
    refresh_token = verify.json()["refresh_token"]

    me = client.get("/api/v1/me", headers={"Authorization": f"Bearer {access_token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "user@example.com"

    refreshed = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert refreshed.status_code == 200
    assert refreshed.json()["token_type"] == "bearer"
