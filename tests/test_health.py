import os

from fastapi.testclient import TestClient

os.environ["API_KEY"] = "test-api-key"
os.environ["RATE_LIMIT_AUTH_REQUESTS_PER_WINDOW"] = "5"

from app.main import app


client = TestClient(app)


def test_root() -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_health() -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_protected_endpoint_requires_api_key() -> None:
    response = client.get("/api/v1/me")
    assert response.status_code == 401


def test_protected_endpoint_accepts_valid_api_key() -> None:
    response = client.get("/api/v1/me", headers={"X-API-Key": "test-api-key"})
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_auth_rate_limit() -> None:
    for _ in range(5):
        response = client.post("/api/v1/auth/request-otp", json={"email": "user@example.com"})
        assert response.status_code == 202

    blocked = client.post("/api/v1/auth/request-otp", json={"email": "user@example.com"})
    assert blocked.status_code == 429
