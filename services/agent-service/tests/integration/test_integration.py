import pytest
from fastapi.testclient import TestClient
from main import app

def test_api_health_integration():
    """
    A basic integration test to ensure the API app boots and
    has all routing available.
    """
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
