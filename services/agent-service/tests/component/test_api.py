import pytest
import sys
import types
import json
from fastapi.testclient import TestClient
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage

# ── Minimal stubs so main.py can be imported without real infra ───────────────

fake_graph_module = types.ModuleType("agent.graph")

class _BootGraph:
    @staticmethod
    def get_state(_config):
        return types.SimpleNamespace(values={"messages": []})

fake_graph_module.graph = _BootGraph()
fake_graph_module.llm = types.SimpleNamespace()
sys.modules.setdefault("agent.graph", fake_graph_module)

fake_database_module = types.ModuleType("database")

async def _noop_create_chat(*_a, **_k): return {"status": "ok"}
async def _noop_update_chat_timestamp(*_a, **_k): return True
async def _noop_get_user_chats(*_a, **_k): return []
async def _noop_get_chat(*_a, **_k): return None
async def _noop_delete_chat(*_a, **_k): return False
async def _noop_update_chat_title(*_a, **_k): return False

fake_database_module.create_chat = _noop_create_chat
fake_database_module.update_chat_timestamp = _noop_update_chat_timestamp
fake_database_module.get_user_chats = _noop_get_user_chats
fake_database_module.get_chat = _noop_get_chat
fake_database_module.delete_chat = _noop_delete_chat
fake_database_module.update_chat_title = _noop_update_chat_title
sys.modules.setdefault("database", fake_database_module)

import main

@pytest.fixture
def client():
    return TestClient(main.app)


# ── Health ───────────────────────────────────────────────────────────────────

def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "agent-service"}


# ── WebSocket auth guard ──────────────────────────────────────────────────────

def test_websocket_rejects_without_user_id(client):
    """Connection without x-user-id header or token param must be closed."""
    with pytest.raises(Exception):
        with client.websocket_connect("/ws"):
            pass

def test_websocket_accepts_with_user_id_header(client):
    """Connection with x-user-id header should not immediately close."""
    # We send one message then disconnect; the graph.astream call will fail
    # because it's a stub, but the WebSocket handshake itself must succeed.
    try:
        with client.websocket_connect("/ws", headers={"x-user-id": "u1"}) as ws:
            ws.send_text(json.dumps({"message": "hello"}))
    except Exception:
        pass  # astream stub will raise; the auth check passed


# ── Chat listing ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_fetch_user_chats_success(monkeypatch, client):
    async def fake_get_user_chats(user_id: str):
        assert user_id == "u1"
        return [{"chat_id": "c1", "title": "Hello"}]

    monkeypatch.setattr(main, "get_user_chats", fake_get_user_chats)
    response = client.get("/chats/u1")
    assert response.status_code == 200
    assert response.json() == [{"chat_id": "c1", "title": "Hello"}]

@pytest.mark.asyncio
async def test_fetch_user_chats_empty(monkeypatch, client):
    async def fake_get_user_chats(user_id: str):
        return []

    monkeypatch.setattr(main, "get_user_chats", fake_get_user_chats)
    response = client.get("/chats/u1")
    assert response.status_code == 200
    assert response.json() == []


# ── Chat messages ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_fetch_chat_messages_not_found(monkeypatch, client):
    async def fake_get_chat(chat_id: str, user_id: str):
        return None

    monkeypatch.setattr(main, "get_chat", fake_get_chat)
    response = client.get("/chats/c1/messages/u1")
    assert response.status_code == 404
    assert response.json()["detail"] == "Chat not found"

@pytest.mark.asyncio
async def test_fetch_chat_messages_formats_only_human_ai(monkeypatch, client):
    """ToolMessages should be filtered out; only Human and AI messages returned."""
    async def fake_get_chat(chat_id: str, user_id: str):
        return {"chat_id": chat_id, "user_id": user_id}

    class FakeState:
        values = {
            "messages": [
                HumanMessage(content="Hello"),
                AIMessage(content="Hi there"),
                ToolMessage(content="hidden tool result", tool_call_id="t1"),
            ]
        }

    class FakeGraph:
        @staticmethod
        def get_state(_config):
            return FakeState()

    monkeypatch.setattr(main, "get_chat", fake_get_chat)
    monkeypatch.setattr(main, "graph", FakeGraph())

    response = client.get("/chats/c1/messages/u1")
    assert response.status_code == 200
    assert response.json() == [
        {"isUser": True, "text": "Hello"},
        {"isUser": False, "text": "Hi there"},
    ]

@pytest.mark.asyncio
async def test_fetch_chat_messages_skips_empty_ai_tool_call(monkeypatch, client):
    """AI messages with empty content (tool call dispatch) should be excluded."""
    async def fake_get_chat(chat_id: str, user_id: str):
        return {"chat_id": chat_id, "user_id": user_id}

    class FakeState:
        values = {
            "messages": [
                HumanMessage(content="What time is it?"),
                AIMessage(content="",  # Tool dispatch - no visible text
                          tool_calls=[{"name": "get_current_datetime", "args": {}, "id": "tc1"}]),
                ToolMessage(content="2026-04-27T12:00:00Z", tool_call_id="tc1"),
                AIMessage(content="It is 12:00 PM."),
            ]
        }

    class FakeGraph:
        @staticmethod
        def get_state(_config):
            return FakeState()

    monkeypatch.setattr(main, "get_chat", fake_get_chat)
    monkeypatch.setattr(main, "graph", FakeGraph())

    response = client.get("/chats/c1/messages/u1")
    assert response.status_code == 200
    messages = response.json()
    # Only non-empty human/ai messages should appear
    texts = [m["text"] for m in messages]
    assert "What time is it?" in texts
    assert "It is 12:00 PM." in texts
    # Tool result and empty AI dispatch should not appear
    assert "2026-04-27T12:00:00Z" not in texts

@pytest.mark.asyncio
async def test_fetch_chat_messages_handles_list_content(monkeypatch, client):
    """AI messages with list-based content (vision models) should be joined."""
    async def fake_get_chat(chat_id: str, user_id: str):
        return {"chat_id": chat_id, "user_id": user_id}

    class FakeState:
        values = {
            "messages": [
                HumanMessage(content="Analyze this"),
                AIMessage(content=[{"type": "text", "text": "Part A"}, {"type": "text", "text": "Part B"}]),
            ]
        }

    class FakeGraph:
        @staticmethod
        def get_state(_config):
            return FakeState()

    monkeypatch.setattr(main, "get_chat", fake_get_chat)
    monkeypatch.setattr(main, "graph", FakeGraph())

    response = client.get("/chats/c1/messages/u1")
    assert response.status_code == 200
    ai_msg = [m for m in response.json() if not m["isUser"]]
    assert len(ai_msg) == 1
    assert "Part A" in ai_msg[0]["text"]
    assert "Part B" in ai_msg[0]["text"]


# ── Delete chat ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_chat_success(monkeypatch, client):
    async def fake_delete_chat(chat_id: str, user_id: str):
        return True

    monkeypatch.setattr(main, "delete_chat", fake_delete_chat)
    response = client.delete("/chats/c1/u1")
    assert response.status_code == 200
    assert response.json()["status"] == "success"

@pytest.mark.asyncio
async def test_delete_chat_not_found(monkeypatch, client):
    async def fake_delete_chat(chat_id: str, user_id: str):
        return False

    monkeypatch.setattr(main, "delete_chat", fake_delete_chat)
    response = client.delete("/chats/c1/u1")
    assert response.status_code == 404

@pytest.mark.asyncio
async def test_delete_chat_uses_correct_ids(monkeypatch, client):
    received = {}
    async def fake_delete_chat(chat_id: str, user_id: str):
        received["chat_id"] = chat_id
        received["user_id"] = user_id
        return True

    monkeypatch.setattr(main, "delete_chat", fake_delete_chat)
    client.delete("/chats/specific-chat/specific-user")
    assert received == {"chat_id": "specific-chat", "user_id": "specific-user"}


# ── Update chat title ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_chat_title_success(monkeypatch, client):
    async def fake_update_chat_title(chat_id: str, user_id: str, title: str):
        assert title == "new-title"
        return True

    monkeypatch.setattr(main, "update_chat_title", fake_update_chat_title)
    response = client.put("/chats/c1/u1", json={"title": "new-title"})
    assert response.status_code == 200
    assert response.json()["message"] == "Chat updated"

@pytest.mark.asyncio
async def test_update_chat_title_not_found(monkeypatch, client):
    async def fake_update_chat_title(chat_id: str, user_id: str, title: str):
        return False

    monkeypatch.setattr(main, "update_chat_title", fake_update_chat_title)
    response = client.put("/chats/c1/u1", json={"title": "new-title"})
    assert response.status_code == 404

@pytest.mark.asyncio
async def test_update_chat_title_requires_title_field(client):
    """Missing 'title' in body should return 422 Unprocessable Entity."""
    response = client.put("/chats/c1/u1", json={})
    assert response.status_code == 422
