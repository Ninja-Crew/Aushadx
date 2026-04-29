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

def test_tools_condition_routes_to_tools():
    from langgraph.prebuilt import tools_condition
    
    # When the last message has tool_calls, tools_condition should route to "tools"
    state = {"messages": [AIMessage(content="", tool_calls=[{"name": "get_current_datetime", "args": {}, "id": "call_1"}])]}
    result = tools_condition(state)
    assert result == "tools"

def test_tools_condition_routes_to_end():
    from langgraph.prebuilt import tools_condition
    
    # When the last message has no tool_calls, tools_condition should route to END ("__end__")
    state = {"messages": [AIMessage(content="Hello, how can I help?")]}
    result = tools_condition(state)
    assert result == "__end__"

def test_graph_multi_agent_switching(monkeypatch):
    """
    Simulates the autonomous multi-agent switching behavior.
    The agent first decides to call a tool, the tool node runs,
    and then the agent generates a final response.
    """
    import json
    from langchain_core.messages import ToolMessage
    from agent.graph import workflow

    # We compile the graph without a checkpointer for easy isolated testing
    test_graph = workflow.compile()

    # Mock the LLM to yield a predefined sequence of responses:
    # 1. A tool call
    # 2. A final text response
    call_count = 0
    def mock_invoke(prompt):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return AIMessage(content="", tool_calls=[{"name": "get_current_datetime", "args": {}, "id": "call_mock"}])
        else:
            return AIMessage(content="The current time has been checked.")

    fake_llm = types.SimpleNamespace(invoke=mock_invoke)
    monkeypatch.setattr(graph_module, "llm_with_tools", fake_llm)

    # We also need to mock the tool node so it doesn't actually run the tool,
    # or we can let it run the actual get_current_datetime tool if it's safe.
    # get_current_datetime is safe. But let's mock the tool node just in case.
    class DummyToolNode:
        def __init__(self, tools):
            pass
        def __call__(self, state, config=None):
            # Simulate the tool execution
            return {"messages": [ToolMessage(content="2026-04-27T12:00:00Z", name="get_current_datetime", tool_call_id="call_mock")]}
    
    # It's easier to mock the tool node directly in the graph or module
    monkeypatch.setattr(graph_module, "tool_node", DummyToolNode([]))
    
    # Recompile with mocked tool_node
    test_graph = graph_module.workflow.compile()

    inputs = {"messages": [HumanMessage(content="What time is it?")]}
    config = {"configurable": {"thread_id": "test_switch"}}
    
    # Run the graph
    result = test_graph.invoke(inputs, config=config)
    
    messages = result["messages"]
    # 1 HumanMessage
    # 1 AIMessage (Tool Call)
    # 1 ToolMessage (Result)
    # 1 AIMessage (Final Response)
    assert len(messages) == 4
    assert isinstance(messages[1], AIMessage)
    assert len(messages[1].tool_calls) == 1
    assert isinstance(messages[2], ToolMessage)
    assert isinstance(messages[3], AIMessage)
    assert messages[3].content == "The current time has been checked."
