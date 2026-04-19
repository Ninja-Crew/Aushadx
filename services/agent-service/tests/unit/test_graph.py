import sys
import types
import pytest
from unittest.mock import MagicMock
from langchain_core.messages import HumanMessage, AIMessage


# Ensure we test the real module, not the stub inserted by test_api.py.
sys.modules.pop("agent.graph", None)

pytest.importorskip("langgraph.checkpoint.mongodb")

from agent import graph as graph_module


def test_graph_module_exports_compiled_graph():
    assert hasattr(graph_module, "graph")
    assert graph_module.graph is not None


def test_call_model_returns_single_ai_message(monkeypatch):
    fake_response = AIMessage(content="Test Response")
    fake_llm = MagicMock()
    fake_llm.invoke.return_value = fake_response

    monkeypatch.setattr(graph_module, "llm_with_tools", fake_llm)

    state = {"messages": [HumanMessage(content="hello")]}
    result = graph_module.call_model(state, config={"configurable": {"thread_id": "u1"}})

    assert len(result["messages"]) == 1
    assert result["messages"][0].content == "Test Response"


def test_call_model_prepends_system_prompt(monkeypatch):
    captured = {}

    def _invoke(messages):
        captured["messages"] = messages
        return AIMessage(content="ok")

    fake_llm = types.SimpleNamespace(invoke=_invoke)
    monkeypatch.setattr(graph_module, "llm_with_tools", fake_llm)

    state = {"messages": [HumanMessage(content="schedule reminder")]} 
    graph_module.call_model(state, config={"configurable": {"thread_id": "u1"}})

    assert captured["messages"][0].content.startswith("You are AushadX")
    assert captured["messages"][1].content == "schedule reminder"
