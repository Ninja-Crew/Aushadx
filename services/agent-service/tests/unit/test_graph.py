import sys
import types
import pytest
from unittest.mock import MagicMock
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage

# Ensure we test the real module, not the stub inserted by test_api.py.
sys.modules.pop("agent.graph", None)

pytest.importorskip("langgraph.checkpoint.mongodb")

from agent import graph as graph_module

def test_graph_module_exports_compiled_graph():
    assert hasattr(graph_module, "graph")
    assert graph_module.graph is not None

def test_supervisor_routes_to_worker(monkeypatch):
    fake_llm = MagicMock()
    fake_llm.invoke.return_value = AIMessage(
        content="", 
        tool_calls=[{"name": "route_to_worker", "args": {"worker_name": "Medical_Management"}, "id": "1"}]
    )
    
    monkeypatch.setattr(graph_module, "supervisor_llm", fake_llm)
    
    state = {"messages": [HumanMessage(content="Schedule a reminder")]}
    result = graph_module.supervisor_node(state, config={})
    
    assert len(result["messages"]) == 1
    assert result["messages"][0].tool_calls[0]["name"] == "route_to_worker"
    assert result["sender"] == "supervisor"

def test_supervisor_answers_directly(monkeypatch):
    fake_llm = MagicMock()
    fake_llm.invoke.return_value = AIMessage(content="Hello! I am AushadX.")
    monkeypatch.setattr(graph_module, "supervisor_llm", fake_llm)
    
    state = {"messages": [HumanMessage(content="hi")]}
    result = graph_module.supervisor_node(state, config={})
    
    assert len(result["messages"]) == 1
    assert result["messages"][0].content == "Hello! I am AushadX."
    assert not result["messages"][0].tool_calls
    assert result["sender"] == "supervisor"

def test_supervisor_router_routes_to_tools():
    state = {"messages": [AIMessage(content="", tool_calls=[{"name": "route_to_worker", "args": {"worker_name": "Medical_Management"}, "id": "1"}])]}
    result = graph_module.supervisor_router(state)
    assert result == "tools"

def test_router_after_tool_routes_to_worker():
    state = {
        "messages": [
            AIMessage(content="", tool_calls=[{"name": "route_to_worker", "args": {"worker_name": "Medical_Management"}, "id": "1"}]),
            ToolMessage(content="Transferred to Medical_Management", tool_call_id="1", name="route_to_worker")
        ]
    }
    result = graph_module.router_after_tool(state)
    assert result == "Medical_Management"

def test_agent_node_factory():
    fake_llm = MagicMock()
    fake_llm.invoke.return_value = AIMessage(content="Worker response")
    
    node = graph_module.create_agent_node(fake_llm, [], "Test Prompt", "Test_Agent")
    
    state = {"messages": [HumanMessage(content="hello")]}
    result = node(state, config={})
    
    assert len(result["messages"]) == 1
    assert result["messages"][0].content == "Worker response"
    assert result["sender"] == "Test_Agent"

def test_agent_router_routes_to_tools_on_tool_calls():
    state = {"messages": [AIMessage(content="", tool_calls=[{"name": "test_tool", "args": {}, "id": "1"}])]}
    result = graph_module.agent_router(state)
    assert result == "tools"

def test_agent_router_routes_to_supervisor_when_done():
    state = {"messages": [AIMessage(content="Done")]}
    result = graph_module.agent_router(state)
    assert result == "supervisor"
