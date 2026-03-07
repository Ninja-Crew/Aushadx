import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch
from langchain_core.messages import AIMessage

def test_health_check():
    from main import app
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "agent-service"}

@patch("main.graph.ainvoke", new_callable=AsyncMock)
def test_chat_success(mock_ainvoke):
    from main import app
    client = TestClient(app)
    mock_ainvoke.return_value = {"messages": [AIMessage(content="Hello there!")]}
    payload = {"message": "Hello", "user_id": "test_user"}
    response = client.post("/api/agent/chat", json=payload)
    assert response.status_code == 200
    assert response.json()["response"] == "Hello there!"
    mock_ainvoke.assert_called_once()
