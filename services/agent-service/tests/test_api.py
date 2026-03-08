import pytest
from fastapi.testclient import TestClient
from main import app

def test_health_check():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "agent-service"}

def test_websocket_rejects_without_user_id():
    client = TestClient(app)
    with pytest.raises(Exception) as excinfo:
        # Connect to websocket without x-user-id header or token query param
        with client.websocket_connect("/ws") as websocket:
            pass
    # Starlette/FastAPI raises a WebSocketDisconnect or similar when closed from server side code=1008
    assert excinfo is not None
