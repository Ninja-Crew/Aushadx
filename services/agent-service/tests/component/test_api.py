import pytest
import sys
import types
from fastapi.testclient import TestClient
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage

fake_graph_module = types.ModuleType("agent.graph")


class _BootGraph:
    @staticmethod
    def get_state(_config):
        return types.SimpleNamespace(values={"messages": []})


fake_graph_module.graph = _BootGraph()
fake_graph_module.llm = types.SimpleNamespace()
sys.modules.setdefault("agent.graph", fake_graph_module)

fake_database_module = types.ModuleType("database")


async def _noop_create_chat(*_args, **_kwargs):
    return {"status": "ok"}


async def _noop_update_chat_timestamp(*_args, **_kwargs):
    return True


async def _noop_get_user_chats(*_args, **_kwargs):
    return []


async def _noop_get_chat(*_args, **_kwargs):
    return None


async def _noop_delete_chat(*_args, **_kwargs):
    return False


async def _noop_update_chat_title(*_args, **_kwargs):
    return False


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


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "agent-service"}


def test_websocket_rejects_without_user_id(client):
    with pytest.raises(Exception):
        with client.websocket_connect("/ws"):
            pass


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
async def test_fetch_chat_messages_not_found(monkeypatch, client):
    async def fake_get_chat(chat_id: str, user_id: str):
        assert chat_id == "c1"
        assert user_id == "u1"
        return None

    monkeypatch.setattr(main, "get_chat", fake_get_chat)

    response = client.get("/chats/c1/messages/u1")

    assert response.status_code == 404
    assert response.json()["detail"] == "Chat not found"


@pytest.mark.asyncio
async def test_fetch_chat_messages_formats_only_human_ai(monkeypatch, client):
    async def fake_get_chat(chat_id: str, user_id: str):
        return {"chat_id": chat_id, "user_id": user_id}

    class FakeState:
        values = {
            "messages": [
                HumanMessage(content="Hello"),
                AIMessage(content="Hi there"),
                ToolMessage(content="hidden tool", tool_call_id="tool-1"),
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
