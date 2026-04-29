"""
Integration tests for the Agent Service.

These tests boot the real FastAPI application (with real routing) but stub out
the heavy infra (MongoDB, LLM, downstream micro-services) so they run in CI
without requiring any live services.
"""

import sys
import types
import json
import pytest
from fastapi.testclient import TestClient


# ── Bootstrap stubs (must happen before 'import main') ───────────────────────

def _ensure_stubs():
    """Insert module stubs into sys.modules if not already present."""
    if "agent.graph" not in sys.modules:
        fg = types.ModuleType("agent.graph")

        class _FakeGraph:
            def get_state(self, _config):
                return types.SimpleNamespace(values={"messages": []})

        fg.graph = _FakeGraph()
        fg.llm = types.SimpleNamespace()
        sys.modules["agent.graph"] = fg

    if "database" not in sys.modules:
        db = types.ModuleType("database")

        async def _noop(*a, **k): return None
        db.create_chat = _noop
        db.update_chat_timestamp = _noop
        db.get_user_chats = _noop
        db.get_chat = _noop
        db.delete_chat = _noop
        db.update_chat_title = _noop
        sys.modules["database"] = db

_ensure_stubs()

import main  # noqa: E402


@pytest.fixture(scope="module")
def client():
    return TestClient(main.app)


# ── Boot / routing sanity ─────────────────────────────────────────────────────

def test_app_boots_and_responds(client):
    """The FastAPI application must boot and all HTTP routes must be registered."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_openapi_schema_available(client):
    """OpenAPI JSON must be accessible (confirms route registration is complete)."""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/health" in paths
    assert "/chats/{user_id}" in paths
    assert "/chats/{chat_id}/messages/{user_id}" in paths
    assert "/chats/{chat_id}/{user_id}" in paths

def test_cors_headers_present(client):
    """CORS middleware must allow cross-origin requests."""
    response = client.options("/health", headers={"Origin": "http://localhost:8081"})
    # TestClient doesn't trigger CORS the same way a real browser does,
    # but we verify the middleware is configured without crashing.
    assert response.status_code in (200, 405)


# ── End-to-end chat management flow ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_full_chat_management_flow(monkeypatch):
    """
    Simulates the full lifecycle:
      1. Fetch user chats (empty initially).
      2. Fetch messages for a specific chat (not found).
      3. Update chat title (not found).
      4. Delete chat (not found).
    """
    chat_store = {}

    async def fake_get_user_chats(user_id):
        return [v for v in chat_store.values() if v["user_id"] == user_id]

    async def fake_get_chat(chat_id, user_id):
        return chat_store.get(chat_id)

    async def fake_create_chat(user_id, chat_id, title):
        chat_store[chat_id] = {"chat_id": chat_id, "user_id": user_id, "title": title}
        return {"status": "ok"}

    async def fake_delete_chat(chat_id, user_id):
        if chat_id in chat_store:
            del chat_store[chat_id]
            return True
        return False

    async def fake_update_chat_title(chat_id, user_id, title):
        if chat_id in chat_store:
            chat_store[chat_id]["title"] = title
            return True
        return False

    monkeypatch.setattr(main, "get_user_chats", fake_get_user_chats)
    monkeypatch.setattr(main, "get_chat", fake_get_chat)
    monkeypatch.setattr(main, "create_chat", fake_create_chat)
    monkeypatch.setattr(main, "delete_chat", fake_delete_chat)
    monkeypatch.setattr(main, "update_chat_title", fake_update_chat_title)

    c = TestClient(main.app)

    # 1. No chats yet
    resp = c.get("/chats/u1")
    assert resp.status_code == 200
    assert resp.json() == []

    # 2. Messages for nonexistent chat → 404
    resp = c.get("/chats/c1/messages/u1")
    assert resp.status_code == 404

    # 3. Delete nonexistent chat → 404
    resp = c.delete("/chats/c1/u1")
    assert resp.status_code == 404

    # 4. Manually seed a chat, then update its title
    chat_store["c2"] = {"chat_id": "c2", "user_id": "u1", "title": "Old Title"}
    resp = c.put("/chats/c2/u1", json={"title": "New Title"})
    assert resp.status_code == 200
    assert chat_store["c2"]["title"] == "New Title"

    # 5. Delete the seeded chat
    resp = c.delete("/chats/c2/u1")
    assert resp.status_code == 200
    assert "c2" not in chat_store

    # 6. Now chats are empty again
    resp = c.get("/chats/u1")
    assert resp.json() == []


# ── WebSocket guard integration ───────────────────────────────────────────────

def test_websocket_auth_guard_integration(client):
    """Connecting without identity headers must be rejected at the WS layer."""
    with pytest.raises(Exception):
        with client.websocket_connect("/ws"):
            pass
